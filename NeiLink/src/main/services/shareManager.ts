/**
 * 分享管理器
 * 核心分享任务管理模块，负责创建、取消、更新分享任务
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as archiver from 'archiver';
import { ShareConfig, SystemSettings } from '../../shared/types';
import { generateKey, encryptFile } from './encryption';
import { startGlobalServer, registerShare, unregisterShare, getGlobalServerPort } from './httpServer';
import { Logger } from './logger';

/** 创建分享任务的参数 */
export interface CreateShareParams {
  filePath: string;
  fileName?: string;
  isFolder?: boolean;
  extractCode?: string;
  expiryTime?: number;
  maxDownloads?: number;
  maxConcurrent?: number;
  uploaderName?: string;
}

/** 分享更新回调 */
export type ShareUpdateCallback = (shares: ShareConfig[]) => void;
/** 下载事件回调 */
export type DownloadCallback = (shareId: string, downloadCount: number) => void;

export class ShareManager {
  private shares: Map<string, ShareConfig> = new Map();
  private logger: Logger;
  private tempDir: string;
  private settings: SystemSettings;
  private shareUpdateCallbacks: ShareUpdateCallback[] = [];
  private downloadCallbacks: DownloadCallback[] = [];
  private expiryCheckInterval: NodeJS.Timeout | null = null;

  /**
   * @param logger 日志记录器
   * @param tempDir 临时文件目录
   * @param settings 系统设置
   */
  constructor(logger: Logger, tempDir: string, settings: SystemSettings) {
    this.logger = logger;
    this.tempDir = tempDir;
    this.settings = settings;

    // 确保临时目录存在
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * 注册分享更新回调
   */
  onShareUpdate(callback: ShareUpdateCallback): void {
    this.shareUpdateCallbacks.push(callback);
  }

  /**
   * 注册下载事件回调
   */
  onDownload(callback: DownloadCallback): void {
    this.downloadCallbacks.push(callback);
  }

  /**
   * 通知所有分享更新回调
   */
  private notifyShareUpdate(): void {
    const shares = this.getAllShares();
    for (const cb of this.shareUpdateCallbacks) {
      try {
        cb(shares);
      } catch (err) {
        console.error('分享更新回调执行失败:', err);
      }
    }
  }

  /**
   * 通知所有下载回调
   */
  private notifyDownload(shareId: string, downloadCount: number): void {
    for (const cb of this.downloadCallbacks) {
      try {
        cb(shareId, downloadCount);
      } catch (err) {
        console.error('下载回调执行失败:', err);
      }
    }
  }

  /**
   * 创建分享任务
   */
  async createShare(params: CreateShareParams): Promise<ShareConfig> {
    const id = crypto.randomUUID();
    const filePath = params.filePath;
    const fileName = params.fileName || path.basename(filePath);
    const isFolder = params.isFolder || fs.statSync(filePath).isDirectory();
    const fileSize = isFolder
      ? this.calculateFolderSize(filePath)
      : fs.statSync(filePath).size;

    // 确保全局服务器已经启动
    const port = await startGlobalServer(this.settings.port, {
      rateLimitEnabled: this.settings.rateLimitEnabled,
      rateLimitMaxAttempts: this.settings.rateLimitMaxAttempts,
      rateLimitBanDuration: this.settings.rateLimitBanDuration,
    });

    // 计算过期时间
    let expiryTime: number | undefined;
    if (params.expiryTime !== undefined) {
      expiryTime = params.expiryTime;
    } else if (this.settings.defaultExpiry > 0) {
      expiryTime = Date.now() + this.settings.defaultExpiry * 60 * 60 * 1000;
    }

    // 生成加密密钥
    const encryptionKey = generateKey(this.settings.encryptionBits);

    // 确定加密文件路径
    const encryptedFilePath = path.join(this.tempDir, `${id}.enc`);

    // 创建分享配置
    const shareConfig: ShareConfig = {
      id,
      filePath,
      fileName,
      fileSize,
      isFolder,
      extractCode: params.extractCode,
      expiryTime,
      maxDownloads: params.maxDownloads ?? this.settings.defaultMaxDownloads,
      maxConcurrent: params.maxConcurrent ?? this.settings.defaultMaxConcurrent,
      uploaderName: params.uploaderName || this.settings.defaultNickname,
      createdAt: Date.now(),
      port,
      status: 'active',
      downloadCount: 0,
      encryptedFilePath,
      encryptionKey,
    };

    try {
      // 如果是文件夹，先打包为 ZIP
      let fileToEncrypt = filePath;
      if (isFolder) {
        const zipPath = path.join(this.tempDir, `${id}.zip`);
        await this.zipFolder(filePath, zipPath);
        fileToEncrypt = zipPath;
      }

      // 加密文件
      await encryptFile(fileToEncrypt, encryptedFilePath, encryptionKey);

      // 注册分享到全局服务器
      registerShare(shareConfig, (shareId) => {
        // 下载完成回调
        const share = this.shares.get(shareId);
        if (share) {
          this.notifyDownload(shareId, share.downloadCount);
        }
      });

      // 保存分享任务
      this.shares.set(id, shareConfig);

      // 记录日志
      this.logger.log('share', `创建分享任务: ${fileName}`, `ID: ${id}, 端口: ${port}, 大小: ${fileSize}`);

      // 通知更新
      this.notifyShareUpdate();

      return shareConfig;
    } catch (err) {
      // 清理临时文件
      this.cleanupTempFiles(id);

      this.logger.log('error', `创建分享任务失败: ${fileName}`, err instanceof Error ? err.message : String(err));
      throw new Error(`创建分享失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * 取消分享任务
   */
  async cancelShare(id: string): Promise<boolean> {
    const share = this.shares.get(id);
    if (!share) {
      return false;
    }

    try {
      // 更新状态为已取消（保留在 Map 中，前端可能需要显示已取消的历史）
      share.status = 'cancelled';

      // 从全局服务器移除分享
      unregisterShare(id);

      // 删除加密临时文件
      this.cleanupTempFiles(id);

      // 记录日志
      this.logger.log('share', `取消分享任务: ${share.fileName}`, `ID: ${id}`);

      // 通知更新
      this.notifyShareUpdate();

      return true;
    } catch (err) {
      this.logger.log('error', `取消分享任务失败: ${id}`, err instanceof Error ? err.message : String(err));
      throw new Error(`取消分享失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * 取消所有分享任务
   */
  async cancelAllShares(): Promise<void> {
    const ids = Array.from(this.shares.keys());
    await Promise.all(ids.map((id) => this.cancelShare(id)));
  }

  /**
   * 获取所有活跃的分享任务
   */
  getAllShares(): ShareConfig[] {
    return Array.from(this.shares.values()).filter(share => share.status === 'active');
  }

  /**
   * 获取指定分享任务
   */
  getShareById(id: string): ShareConfig | undefined {
    return this.shares.get(id);
  }

  /**
   * 更新分享配置
   */
  async updateShareConfig(id: string, config: Partial<ShareConfig>): Promise<ShareConfig | null> {
    const share = this.shares.get(id);
    if (!share) {
      return null;
    }

    // 允许更新的字段
    const updatableFields: (keyof ShareConfig)[] = [
      'extractCode',
      'expiryTime',
      'maxDownloads',
      'maxConcurrent',
    ];

    for (const field of updatableFields) {
      if (config[field] !== undefined) {
        (share as unknown as Record<string, unknown>)[field] = config[field];
      }
    }

    // 记录日志
    this.logger.log('share', `更新分享配置: ${share.fileName}`, `ID: ${id}`);

    // 通知更新
    this.notifyShareUpdate();

    return share;
  }

  /**
   * 启动过期检查定时任务
   * @param intervalMs 检查间隔（毫秒），默认 60000（1分钟）
   */
  startExpiryCheck(intervalMs: number = 60000): void {
    if (this.expiryCheckInterval) {
      return;
    }

    this.expiryCheckInterval = setInterval(() => {
      this.checkShareExpiry();
    }, intervalMs);

    // 立即执行一次检查
    this.checkShareExpiry();
  }

  /**
   * 停止过期检查
   */
  stopExpiryCheck(): void {
    if (this.expiryCheckInterval) {
      clearInterval(this.expiryCheckInterval);
      this.expiryCheckInterval = null;
    }
  }

  /**
   * 检查并过期超时的分享任务
   */
  checkShareExpiry(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [id, share] of this.shares) {
      if (share.status !== 'active') continue;

      // 检查是否过期
      if (share.expiryTime && now >= share.expiryTime) {
        share.status = 'expired';
        unregisterShare(id);
        this.cleanupTempFiles(id);
        expiredCount++;
      }

      // 检查是否达到最大下载次数
      if (share.maxDownloads !== -1 && share.downloadCount >= share.maxDownloads) {
        share.status = 'expired';
        unregisterShare(id);
        this.cleanupTempFiles(id);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.log('system', `${expiredCount} 个分享任务已过期`);
      this.notifyShareUpdate();
    }
  }

  /**
   * 更新系统设置引用
   */
  updateSettings(settings: SystemSettings): void {
    this.settings = settings;
  }

  /**
   * 计算文件夹大小
   */
  private calculateFolderSize(dirPath: string): number {
    let totalSize = 0;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += this.calculateFolderSize(fullPath);
      } else if (entry.isFile()) {
        totalSize += fs.statSync(fullPath).size;
      }
    }

    return totalSize;
  }

  /**
   * 将文件夹打包为 ZIP
   */
  private zipFolder(sourcePath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = (archiver as unknown as (format: string, options?: Record<string, unknown>) => archiver.Archiver)('zip', {
        zlib: { level: 5 }, // 中等压缩级别
      });

      output.on('close', () => {
        resolve();
      });

      archive.on('error', (err) => {
        reject(new Error(`打包失败: ${err.message}`));
      });

      archive.pipe(output);

      // 获取文件夹名作为 ZIP 内的根目录名
      const folderName = path.basename(sourcePath);
      archive.directory(sourcePath, folderName);

      archive.finalize();
    });
  }

  /**
   * 生成随机提取码
   */
  private generateExtractCode(length: number = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去除容易混淆的字符
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * 清理临时文件
   */
  private cleanupTempFiles(id: string): void {
    const extensions = ['.enc', '.zip'];
    for (const ext of extensions) {
      const filePath = path.join(this.tempDir, `${id}${ext}`);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error(`清理临时文件失败: ${filePath}`, err);
      }
    }
  }

  /**
   * 销毁管理器，清理所有资源
   */
  async destroy(): Promise<void> {
    this.stopExpiryCheck();
    await this.cancelAllShares();
  }
}
