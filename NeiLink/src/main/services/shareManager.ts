/**
 * 分享管理器
 * 核心分享任务管理模块，负责创建、取消、更新分享任务
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import archiver from 'archiver';
import { ShareConfig, SystemSettings } from '../../shared/types';
import { startGlobalServer, registerShare, unregisterShare, getGlobalServerPort } from './httpServer';
import { Logger } from './logger';

/** 创建分享任务的参数 */
export interface CreateShareParams {
  filePath: string;
  fileName?: string;
  isFolder?: boolean;
  extractCode?: string;
  expiryTime?: number | null;
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
  private dataDir: string;
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
    this.dataDir = path.join(path.dirname(tempDir), 'data');
    this.settings = settings;

    // 确保目录存在
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // 尝试恢复之前的分享任务
    this.loadShares().catch(err => {
      console.error('加载分享任务失败:', err);
    });
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
   * 处理下载完成：通知回调，并在达到最大下载次数时立即标记为过期
   */
  private handleDownloadComplete(shareId: string): void {
    const share = this.shares.get(shareId);
    if (!share) return;

    this.notifyDownload(shareId, share.downloadCount);

    if (share.maxDownloads !== -1 && share.downloadCount >= share.maxDownloads) {
      share.status = 'expired';
      this.saveShares();
      this.logger.log('system', `分享任务因达到最大下载次数而过期: ${share.fileName} (ID: ${shareId})`, { messageKey: 'share.expired.maxDownloads', messageParams: [share.fileName, shareId] });
      this.notifyShareUpdate();
    }
  }

  /**
   * 创建分享任务（流式版本，零预加密预压缩）
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
    if (params.expiryTime === null) {
      // 用户明确选择了永久，不设置过期时间
      expiryTime = undefined;
    } else if (params.expiryTime !== undefined) {
      expiryTime = params.expiryTime;
    } else if (this.settings.defaultExpiry && this.settings.defaultExpiry !== 'permanent') {
      const expiryStr = this.settings.defaultExpiry;
      const now = Date.now();
      switch (expiryStr) {
        case '1h':
          expiryTime = now + 60 * 60 * 1000;
          break;
        case '6h':
          expiryTime = now + 6 * 60 * 60 * 1000;
          break;
        case '24h':
          expiryTime = now + 24 * 60 * 60 * 1000;
          break;
        case '7d':
          expiryTime = now + 7 * 24 * 60 * 60 * 1000;
          break;
        case '30d':
          expiryTime = now + 30 * 24 * 60 * 60 * 1000;
          break;
        // permanent 不设置 expiryTime
      }
    }

    // 创建分享配置 - 如果是文件夹，文件名加上 .zip 后缀
    const finalFileName = isFolder ? `${fileName}.zip` : fileName;
    const shareConfig: ShareConfig = {
      id,
      filePath,
      fileName: finalFileName,
      fileSize,
      isFolder,
      extractCode: params.extractCode,
      expiryTime,
      maxDownloads: params.maxDownloads ?? this.settings.defaultMaxDownloads,
      maxConcurrent: params.maxConcurrent ?? this.settings.defaultMaxConcurrent,
      uploaderName: params.uploaderName || this.settings.userName || this.settings.defaultNickname,
      createdAt: Date.now(),
      port,
      status: 'active',
      downloadCount: 0,
    };

    try {
      // 直接注册分享到全局服务器（零预加密等待！）
      registerShare(shareConfig, (shareId) => {
        this.handleDownloadComplete(shareId);
      });

      // 保存分享任务
      this.shares.set(id, shareConfig);

      // 保存到文件
      this.saveShares();

      // 记录日志
      this.logger.log('share', `创建分享任务: ${finalFileName}`, { detail: `ID: ${id}, 端口: ${port}, 大小: ${fileSize}`, messageKey: 'share.created', messageParams: [finalFileName] });

      // 通知更新
      this.notifyShareUpdate();

      return shareConfig;
    } catch (err) {
      this.logger.log('error', `创建分享任务失败: ${finalFileName}`, { detail: err instanceof Error ? err.message : String(err), messageKey: 'error.createShareTask', messageParams: [finalFileName] });
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
      // 从 Map 中删除分享
      this.shares.delete(id);

      // 从全局服务器移除分享
      unregisterShare(id);

      // 删除加密临时文件
      this.cleanupTempFiles(id);

      // 保存到文件
      this.saveShares();

      // 记录日志
      this.logger.log('share', `取消分享任务: ${share.fileName}`, { detail: `ID: ${id}`, messageKey: 'share.cancelled', messageParams: [share.fileName] });

      // 通知更新
      this.notifyShareUpdate();

      return true;
    } catch (err) {
      this.logger.log('error', `取消分享任务失败: ${id}`, { detail: err instanceof Error ? err.message : String(err), messageKey: 'error.cancelShareTask', messageParams: [id] });
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
   * 获取所有分享任务（包括已过期和已取消的）
   */
  getAllShares(): ShareConfig[] {
    return Array.from(this.shares.values());
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
      if (field in config) {
        let value = config[field];
        // 特殊处理：如果expiryTime是null，表示永久，设置为undefined
        if (field === 'expiryTime' && value === null) {
          (share as unknown as Record<string, unknown>)[field] = undefined;
        } else {
          (share as unknown as Record<string, unknown>)[field] = value;
        }
      }
    }

    // 重置下载次数
    share.downloadCount = 0;
    
    // 重新激活分享：如果是已过期或已取消，并且有有效的过期时间（或永久），重新激活
    if (share.status !== 'active') {
      // 检查是否可以重新激活
      const now = Date.now();
      const canReactivate = !share.expiryTime || (share.expiryTime > now);
      if (canReactivate) {
        share.status = 'active';
        // 重新注册到服务器
        registerShare(share, (shareId) => {
          this.handleDownloadComplete(shareId);
        });
      }
    } else {
      // 如果分享已经是活跃状态，也需要更新服务器端的分享配置
      // 确保服务器端的 downloadCount 被正确重置
      registerShare(share, (shareId) => {
        this.handleDownloadComplete(shareId);
      });
    }

    // 保存到文件
    this.saveShares();

    // 记录日志
    this.logger.log('share', `更新分享配置: ${share.fileName}`, { detail: `ID: ${id}`, messageKey: 'share.configUpdated', messageParams: [share.fileName] });

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
        expiredCount++;
      }

      // 检查是否达到最大下载次数
      if (share.maxDownloads !== -1 && share.downloadCount >= share.maxDownloads) {
        share.status = 'expired';
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      // 保存更新后的状态
      this.saveShares();
      this.logger.log('system', `${expiredCount} 个分享任务已过期`, { messageKey: 'share.expired.count', messageParams: [String(expiredCount)] });
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
      const archive = archiver('zip', {
        zlib: { level: 5 }, // 中等压缩级别
      });

      output.on('close', () => {
        resolve();
      });

      archive.on('error', (err: Error) => {
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
   * 保存分享任务到文件
   */
  private saveShares(): void {
    try {
      const sharesData = Array.from(this.shares.values());
      const sharesFilePath = path.join(this.dataDir, 'shares.json');
      fs.writeFileSync(sharesFilePath, JSON.stringify(sharesData, null, 2), 'utf-8');
    } catch (err) {
      console.error('保存分享任务失败:', err);
    }
  }

  /**
   * 从文件加载分享任务
   */
  private async loadShares(): Promise<void> {
    try {
      const sharesFilePath = path.join(this.dataDir, 'shares.json');
      if (!fs.existsSync(sharesFilePath)) {
        return;
      }

      const sharesData = JSON.parse(fs.readFileSync(sharesFilePath, 'utf-8')) as ShareConfig[];
      
      // 先确保服务器已启动
      const port = await startGlobalServer(this.settings.port, {
        rateLimitEnabled: this.settings.rateLimitEnabled,
        rateLimitMaxAttempts: this.settings.rateLimitMaxAttempts,
        rateLimitBanDuration: this.settings.rateLimitBanDuration,
      });
      
      let restoredCount = 0;
      for (const share of sharesData) {
        // 检查原始文件是否存在
        const originalFileExists = fs.existsSync(share.filePath);
        
        // 只要原始文件存在就恢复（支持新旧分享任务
        if (originalFileExists) {
          // 确保端口一致
          share.port = port;
          
          // 只有活跃的分享才注册到服务器
          if (share.status === 'active') {
            registerShare(share, (shareId) => {
              this.handleDownloadComplete(shareId);
            });
          }
          
          this.shares.set(share.id, share);
          restoredCount++;
        }
      }

      if (restoredCount > 0) {
        this.logger.log('system', `已恢复 ${restoredCount} 个分享任务`, { messageKey: 'share.restored', messageParams: [String(restoredCount)] });
        // 通知前端更新分享列表
        this.notifyShareUpdate();
      }
    } catch (err) {
      console.error('加载分享任务失败:', err);
    }
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
   * 根据设置决定是否删除分享文件
   */
  async destroy(): Promise<void> {
    this.stopExpiryCheck();
    
    if (this.settings.clearSharesOnExit) {
      // 如果设置为关闭时删除，则删除所有分享
      await this.cancelAllShares();
      // 删除保存的分享数据文件
      const sharesFilePath = path.join(this.dataDir, 'shares.json');
      try {
        if (fs.existsSync(sharesFilePath)) {
          fs.unlinkSync(sharesFilePath);
        }
      } catch (err) {
        console.error('删除分享数据文件失败:', err);
      }
      this.logger.log('system', '应用关闭，已删除所有分享任务', { messageKey: 'share.destroyed' });
    } else {
      // 否则保存当前分享状态，下次启动时恢复
      this.saveShares();
    }
  }
}
