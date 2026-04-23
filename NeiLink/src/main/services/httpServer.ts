/**
 * HTTP 文件服务器模块
 * 所有分享任务使用同一个 HTTP 服务器，通过 URL 路径区分不同分享
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import archiver from 'archiver';
import { ShareConfig, SystemSettings } from '../../shared/types';
import { Logger } from './logger';
import { generateReceiverHTML, generateFileCodeInputHTML, ShareInfo } from './receiverPage';
import { createEncryptStream } from './encryption';

let logger: Logger | null = null;

export function setLogger(l: Logger): void {
  logger = l;
}

/** 限流记录 */
interface RateLimitRecord {
  attempts: number;
  windowStart: number;
  banned: boolean;
  banExpiry: number;
}

/** 全局 HTTP 服务器实例 */
let globalServer: http.Server | null = null;

/** 全局服务器监听的端口 */
let globalServerPort: number | null = null;

/** 分享配置存储（文件码 -> 分享配置） */
const shares: Map<string, ShareConfig> = new Map();

/** 下载回调存储（文件码 -> 下载回调） */
const downloadCallbacks: Map<string, (shareId: string) => void> = new Map();

/** 限流设置 */
let rateLimitSettings: {
  rateLimitEnabled?: boolean;
  rateLimitMaxAttempts?: number;
  rateLimitBanDuration?: number;
} = {};

/** 限流记录存储（IP -> 记录） */
const rateLimitRecords: Map<string, RateLimitRecord> = new Map();

/** 用户设置 */
let userSettings: Partial<SystemSettings> = {};

/**
 * 更新用户设置
 */
export function updateUserSettings(settings: Partial<SystemSettings>): void {
  userSettings = { ...userSettings, ...settings };
}

/**
 * 获取用户设置
 */
export function getUserSettings(): Partial<SystemSettings> {
  return { ...userSettings };
}

/**
 * 格式化文件大小为可读字符串
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

/**
 * 将 ShareConfig 转换为 ShareInfo
 */
function toShareInfo(shareConfig: ShareConfig): ShareInfo {
  return {
    fileName: shareConfig.fileName,
    fileSize: shareConfig.fileSize,
    uploaderName: shareConfig.uploaderName,
    hasExtractCode: !!shareConfig.extractCode,
    expiryTime: shareConfig.expiryTime,
    remainingDownloads: shareConfig.maxDownloads === -1 ? undefined : shareConfig.maxDownloads - shareConfig.downloadCount,
    isFolder: shareConfig.isFolder,
    shareId: shareConfig.id,
    userAvatar: userSettings.userAvatar,
    userName: userSettings.userName,
  };
}

/**
 * 检查并执行限流
 * @returns true 表示被限流（拒绝访问），false 表示允许访问
 */
function checkRateLimit(
  ip: string,
  maxAttempts: number,
  banDuration: number
): boolean {
  const now = Date.now();
  const WINDOW_MS = 60 * 1000; // 1分钟时间窗口
  let record = rateLimitRecords.get(ip);

  if (!record) {
    record = { attempts: 0, windowStart: now, banned: false, banExpiry: 0 };
    rateLimitRecords.set(ip, record);
  }

  // 检查是否在封禁期
  if (record.banned) {
    if (now < record.banExpiry) {
      return true; // 仍在封禁中
    }
    // 封禁期已过，重置记录
    record.banned = false;
    record.attempts = 0;
    record.windowStart = now;
  }

  // 检查是否需要重置时间窗口
  if (now - record.windowStart > WINDOW_MS) {
    record.attempts = 0;
    record.windowStart = now;
  }

  // 增加访问计数
  record.attempts++;

  // 检查是否超过最大尝试次数
  if (record.attempts > maxAttempts) {
    record.banned = true;
    record.banExpiry = now + banDuration * 60 * 1000;
    if (logger) {
      logger.log('system', `封禁IP: ${ip}，每分钟尝试次数: ${record.attempts}，封禁时长: ${banDuration}分钟`);
    }
    return true;
  }

  return false;
}

/**
 * 获取客户端 IP 地址
 */
function getClientIP(req: http.IncomingMessage): string {
  let ip: string | undefined;
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    ip = forwarded.split(',')[0].trim();
  } else {
    ip = req.socket.remoteAddress;
  }
  
  // 标准化 IPv6 地址，例如 ::ffff:127.0.0.1 -> 127.0.0.1
  if (ip && ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  return ip || 'unknown';
}

/**
 * 更新限流设置
 */
export function updateRateLimitSettings(settings: {
  rateLimitEnabled?: boolean;
  rateLimitMaxAttempts?: number;
  rateLimitBanDuration?: number;
}): void {
  rateLimitSettings = { ...rateLimitSettings, ...settings };
}

/**
 * 发送 JSON 响应
 */
function sendJSON(res: http.ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
  });
  res.end(JSON.stringify(data));
}

/**
 * 解析 Range 头
 */
function parseRange(rangeHeader: string | undefined, fileSize: number): { start: number; end: number } | null {
  if (!rangeHeader) return null;

  const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);
  if (!match) return null;

  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize || start > end) {
    return null;
  }

  return { start, end };
}

/**
 * 启动全局 HTTP 服务器
 * @param port 监听端口
 * @param settings 限流设置
 */
export function startGlobalServer(
  port: number,
  settings?: {
    rateLimitEnabled?: boolean;
    rateLimitMaxAttempts?: number;
    rateLimitBanDuration?: number;
  }
): Promise<number> {
  return new Promise((resolve, reject) => {
    // 如果服务器已经在运行，直接返回
    if (globalServer && globalServerPort) {
      resolve(globalServerPort);
      return;
    }

    // 保存限流设置
    if (settings) {
      rateLimitSettings = settings;
    }

    // 创建全局服务器
    globalServer = http.createServer((req, res) => {
      const clientIP = getClientIP(req);

      // CORS 预检请求
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Range',
        });
        res.end();
        return;
      }

      // Favicon 路由
      if (req.method === 'GET' && (req.url === '/favicon.ico' || req.url === '/NeiLink.ico')) {
        // 使用默认图标
        const faviconPath = path.join(__dirname, '../assets/NeiLink.ico');
        if (fs.existsSync(faviconPath)) {
          res.writeHead(200, {
            'Content-Type': 'image/x-icon',
            'Access-Control-Allow-Origin': '*',
          });
          fs.createReadStream(faviconPath).pipe(res);
          return;
        }
      }

      // 限流检查
      if (rateLimitSettings.rateLimitEnabled) {
        const isLimited = checkRateLimit(
          clientIP,
          rateLimitSettings.rateLimitMaxAttempts || 10,
          rateLimitSettings.rateLimitBanDuration || 30
        );
        if (isLimited) {
          sendJSON(res, 429, { error: '请求过于频繁，请稍后再试' });
          return;
        }
      }

      // 路由处理
      if (req.method === 'GET' && req.url === '/') {
        // 返回文件码输入页面
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(generateFileCodeInputHTML());
        return;
      }

      if (req.method === 'GET' && req.url && req.url.length > 1 && !req.url.startsWith('/api/')) {
        // 处理文件码路径，如 /$文件码$
        const fileCode = req.url.substring(1);
        const shareConfig = shares.get(fileCode);
        if (shareConfig) {
          // 文件码匹配，返回接收端 Web 页面
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(generateReceiverHTML(toShareInfo(shareConfig)));
          return;
        } else {
          // 文件码不匹配，返回错误页面
          sendJSON(res, 404, { error: '文件码错误或不存在' });
          return;
        }
      }

      if (req.method === 'GET' && req.url?.startsWith('/api/share-info/')) {
        // 返回分享信息（不含提取码和密钥）
        const fileCode = req.url.substring('/api/share-info/'.length);
        const shareConfig = shares.get(fileCode);
        if (!shareConfig) {
          sendJSON(res, 404, { error: '分享不存在' });
          return;
        }
        if (shareConfig.status !== 'active') {
          sendJSON(res, 410, { error: '该分享已过期或被取消' });
          return;
        }
        sendJSON(res, 200, {
          fileName: shareConfig.fileName,
          fileSize: shareConfig.fileSize,
          isFolder: shareConfig.isFolder,
          uploaderName: shareConfig.uploaderName,
          hasExtractCode: !!shareConfig.extractCode,
          createdAt: shareConfig.createdAt,
          userAvatar: userSettings.userAvatar,
          userName: userSettings.userName,
        });
        return;
      }

      if (req.method === 'POST' && req.url?.startsWith('/api/verify/')) {
        // 验证提取码
        const fileCode = req.url.substring('/api/verify/'.length);
        const shareConfig = shares.get(fileCode);
        if (!shareConfig) {
          sendJSON(res, 404, { error: '分享不存在' });
          return;
        }
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (!shareConfig.extractCode) {
              sendJSON(res, 200, { success: true });
              return;
            }
            if (data.code === shareConfig.extractCode) {
              sendJSON(res, 200, { success: true });
            } else {
              sendJSON(res, 403, { success: false, error: '提取码错误' });
            }
          } catch {
            sendJSON(res, 400, { success: false, error: '无效的请求' });
          }
        });
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/api/download/')) {
        // 文件下载（流式传输版本）
        const fileCode = req.url.substring('/api/download/'.length);
        const shareConfig = shares.get(fileCode);
        if (!shareConfig) {
          sendJSON(res, 404, { error: '分享不存在' });
          return;
        }

        // 检查原始文件是否存在
        if (!shareConfig.filePath || !fs.existsSync(shareConfig.filePath)) {
          sendJSON(res, 404, { error: '文件不存在' });
          return;
        }

        if (shareConfig.status !== 'active') {
          sendJSON(res, 410, { error: '该分享已过期或被取消' });
          return;
        }

        // 检查下载次数限制
        if (shareConfig.maxDownloads !== -1 && shareConfig.downloadCount >= shareConfig.maxDownloads) {
          sendJSON(res, 410, { error: '已达到最大下载次数' });
          return;
        }

        const headers: http.OutgoingHttpHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(shareConfig.fileName)}"`,
        };

        // 先绑定事件监听器，再发送响应
        res.on('finish', () => {
          shareConfig.downloadCount++;
          if (logger) {
            logger.log('download', `文件下载成功: ${shareConfig.fileName} (下载码: ${fileCode})，下载IP: ${clientIP}`);
          }
          const onDownload = downloadCallbacks.get(fileCode);
          if (onDownload) {
            onDownload(shareConfig.id);
          }
        });

        // 向后兼容：检查是否有旧的预加密文件
        if (shareConfig.encryptedFilePath && fs.existsSync(shareConfig.encryptedFilePath)) {
          // 使用旧的解密下载流程
          const filePath = shareConfig.encryptedFilePath;
          const stat = fs.statSync(filePath);
          const ivBuffer = Buffer.alloc(16);
          const fd = fs.openSync(filePath, 'r');
          fs.readSync(fd, ivBuffer, 0, 16, 0);
          fs.closeSync(fd);
          
          const keyBuffer = Buffer.from(shareConfig.encryptionKey!, 'hex');
          headers['Content-Length'] = shareConfig.fileSize;
          
          res.writeHead(200, headers);
          
          const inputStream = fs.createReadStream(filePath, { start: 16 });
          const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer);
          inputStream.pipe(decipher).pipe(res);
        } else {
          // ========== 新流式传输逻辑 ==========
          try {
            // ========== 处理文件夹 vs 文件 ==========
            if (shareConfig.isFolder) {
              // 文件夹：使用 archiver 流式打包 -> 传输（chunked encoding，无 Content-Length）
              res.writeHead(200, headers);
              const archive = archiver('zip', { zlib: { level: 1 } });
              
              // 将文件夹内容加入压缩包（文件夹名作为根目录）
              const folderName = path.basename(shareConfig.filePath);
              archive.directory(shareConfig.filePath, folderName);
              
              // 管道：archiver -> 响应
              archive.pipe(res);
              
              archive.on('error', (err) => {
                if (!res.headersSent) {
                  sendJSON(res, 500, { error: '文件压缩失败' });
                }
                console.error('Archive error:', err);
              });
              
              archive.finalize();
            } else {
              // 单文件：直接流式传输，设置 Content-Length
              const stat = fs.statSync(shareConfig.filePath);
              headers['Content-Length'] = stat.size;
              res.writeHead(200, headers);
              
              const inputStream = fs.createReadStream(shareConfig.filePath);
              inputStream.pipe(res);
              
              inputStream.on('error', (err) => {
                if (!res.headersSent) {
                  sendJSON(res, 500, { error: '文件读取失败' });
                }
                console.error('File read error:', err);
              });
            }
          } catch (err) {
            if (!res.headersSent) {
              sendJSON(res, 500, { error: '文件传输失败' });
            }
            console.error('Download error:', err);
          }
        }

        return;
      }

      // 404
      sendJSON(res, 404, { error: '未找到请求的资源' });
    });

    globalServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`端口 ${port} 已被占用`));
      } else {
        reject(new Error(`服务器启动失败: ${err.message}`));
      }
    });

    globalServer.listen(port, '0.0.0.0', () => {
      globalServerPort = port;
      resolve(port);
    });
  });
}

/**
 * 注册分享到全局服务器
 * @param shareConfig 分享配置
 * @param onDownload 下载完成回调
 */
export function registerShare(
  shareConfig: ShareConfig,
  onDownload?: (shareId: string) => void
): void {
  const fileCode = shareConfig.id;
  shares.set(fileCode, shareConfig);
  if (onDownload) {
    downloadCallbacks.set(fileCode, onDownload);
  }
}

/**
 * 从全局服务器移除分享
 * @param fileCode 文件码
 */
export function unregisterShare(fileCode: string): void {
  shares.delete(fileCode);
  downloadCallbacks.delete(fileCode);
}

/**
 * 获取全局服务器端口
 */
export function getGlobalServerPort(): number | null {
  return globalServerPort;
}

/**
 * 停止全局 HTTP 服务器
 */
export function stopGlobalServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!globalServer) {
      resolve();
      return;
    }

    globalServer.close(() => {
      globalServer = null;
      globalServerPort = null;
      shares.clear();
      downloadCallbacks.clear();
      resolve();
    });
  });
}

/**
 * 为了保持向后兼容性，保留这些函数但它们什么都不做
 */
export function createServer(): Promise<number> {
  return Promise.resolve(globalServerPort || 3000);
}

export function stopServer(): Promise<void> {
  return Promise.resolve();
}

export function stopAllServers(): Promise<void> {
  return stopGlobalServer();
}

export function isServerRunning(): boolean {
  return globalServer !== null && globalServerPort !== null;
}

export interface BannedIPInfo {
  ip: string;
  attempts: number;
  windowStart: number;
  banExpiry: number;
  remainingTime: number;
}

export function getBannedIPs(): BannedIPInfo[] {
  const now = Date.now();
  const result: BannedIPInfo[] = [];
  
  rateLimitRecords.forEach((record, ip) => {
    if (record.banned && now < record.banExpiry) {
      result.push({
        ip,
        attempts: record.attempts,
        windowStart: record.windowStart,
        banExpiry: record.banExpiry,
        remainingTime: Math.ceil((record.banExpiry - now) / 1000),
      });
    }
  });
  
  return result.sort((a, b) => a.banExpiry - b.banExpiry);
}

export function unbanIP(ip: string): boolean {
  const record = rateLimitRecords.get(ip);
  if (record && record.banned) {
    record.banned = false;
    record.banExpiry = 0;
    record.attempts = 0;
    record.windowStart = Date.now();
    if (logger) {
      logger.log('system', `解封IP: ${ip}`);
    }
    return true;
  }
  return false;
}

export function updateBanDuration(ip: string, durationMinutes: number): boolean {
  const record = rateLimitRecords.get(ip);
  if (record && record.banned) {
    const now = Date.now();
    record.banExpiry = now + durationMinutes * 60 * 1000;
    if (logger) {
      logger.log('system', `更新封禁时长: ${ip} -> ${durationMinutes}分钟`);
    }
    return true;
  }
  return false;
}
