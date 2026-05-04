/**
 * HTTP 文件服务器模块
 * 所有分享任务使用同一个 HTTP 服务器，通过 URL 路径区分不同分享
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Transform, TransformCallback } from 'stream';
import archiver from 'archiver';
import { ShareConfig, SystemSettings } from '../../shared/types';
import { Logger } from './logger';
import { generateReceiverHTML, generateFileCodeInputHTML, sendErrorPage, ShareInfo } from './receiverPage';
import { getLocale } from '../../shared/i18n';

// =============================================================================
// 类型定义
// =============================================================================

interface RateLimitRecord {
  attempts: number;
  windowStart: number;
  banned: boolean;
  banExpiry: number;
}

export interface BannedIPInfo {
  ip: string;
  attempts: number;
  windowStart: number;
  banExpiry: number;
  remainingTime: number;
}

// =============================================================================
// 模块状态
// =============================================================================

let logger: Logger | null = null;

let globalServer: http.Server | null = null;
let globalServerPort: number | null = null;

const shares: Map<string, ShareConfig> = new Map();
const downloadCallbacks: Map<string, (shareId: string) => void> = new Map();

let rateLimitSettings: {
  rateLimitEnabled?: boolean;
  rateLimitMaxAttempts?: number;
  rateLimitBanDuration?: number;
} = {};

const rateLimitRecords: Map<string, RateLimitRecord> = new Map();

let userSettings: Partial<SystemSettings> = {};

let downloadSpeedLimit: number = 0; // KB/s, 0 = 不限制

// =============================================================================
// 工具函数
// =============================================================================

function toShareInfo(shareConfig: ShareConfig): ShareInfo {
  return {
    fileName: shareConfig.fileName,
    fileSize: shareConfig.fileSize,
    uploaderName: shareConfig.uploaderName,
    hasExtractCode: !!shareConfig.extractCode,
    expiryTime: shareConfig.expiryTime,
    remainingDownloads:
      shareConfig.maxDownloads === -1
        ? undefined
        : shareConfig.maxDownloads - shareConfig.downloadCount,
    isFolder: shareConfig.isFolder,
    shareId: shareConfig.id,
    userAvatar: userSettings.userAvatar,
    userName: userSettings.userName,
  };
}

function getClientIP(req: http.IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  let ip: string | undefined;
  if (typeof forwarded === 'string') {
    ip = forwarded.split(',')[0].trim();
  } else {
    ip = req.socket.remoteAddress;
  }
  if (ip && ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  return ip || 'unknown';
}

class ThrottleTransform extends Transform {
  private bytesPerSecond: number;
  private startTime: number = 0;
  private bytesSent: number = 0;

  constructor(bytesPerSecond: number) {
    super();
    this.bytesPerSecond = bytesPerSecond;
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    if (this.bytesPerSecond <= 0) {
      this.push(chunk);
      callback();
      return;
    }

    if (this.startTime === 0) {
      this.startTime = Date.now();
    }

    this.bytesSent += chunk.length;

    // 按目标速率计算当前字节数对应的预期耗时
    const expectedElapsed = (this.bytesSent / this.bytesPerSecond) * 1000;
    const actualElapsed = Date.now() - this.startTime;

    if (actualElapsed >= expectedElapsed) {
      // 落后于预期进度，立即发送
      this.push(chunk);
      callback();
    } else {
      // 超前了，延迟发送
      const delay = Math.ceil(expectedElapsed - actualElapsed);
      setTimeout(() => {
        this.push(chunk);
        callback();
      }, delay);
    }
  }
}

function createThrottle(): ThrottleTransform {
  return new ThrottleTransform(downloadSpeedLimit * 1024); // KB/s -> bytes/s
}

function sendJSON(res: http.ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
  });
  res.end(JSON.stringify(data));
}

function sendHTML(res: http.ServerResponse, statusCode: number, html: string): void {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(html);
}

function detectLanguage(req: http.IncomingMessage): string {
  // query parameter override: ?lang=zh-CN or ?lang=en-US
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const langParam = url.searchParams.get('lang');
    if (langParam === 'zh-CN' || langParam === 'en-US') return langParam;
  } catch {
    // fall through to header detection
  }

  // Accept-Language header
  const acceptLang = req.headers['accept-language'];
  if (acceptLang) {
    if (acceptLang.includes('zh')) return 'zh-CN';
    if (acceptLang.includes('en')) return 'en-US';
  }
  return 'zh-CN';
}

// =============================================================================
// 限流
// =============================================================================

function checkRateLimit(ip: string, maxAttempts: number, banDuration: number): boolean {
  const now = Date.now();
  const WINDOW_MS = 60 * 1000;

  let record = rateLimitRecords.get(ip);
  if (!record) {
    record = { attempts: 0, windowStart: now, banned: false, banExpiry: 0 };
    rateLimitRecords.set(ip, record);
  }

  if (record.banned) {
    if (now < record.banExpiry) return true;
    record.banned = false;
    record.attempts = 0;
    record.windowStart = now;
  }

  if (now - record.windowStart > WINDOW_MS) {
    record.attempts = 0;
    record.windowStart = now;
  }

  record.attempts++;

  if (record.attempts > maxAttempts) {
    record.banned = true;
    record.banExpiry = now + banDuration * 60 * 1000;
    logger?.log('system', `封禁IP: ${ip}，每分钟尝试次数: ${record.attempts}，封禁时长: ${banDuration}分钟`, { messageKey: 'bannedIP.blocked', messageParams: [ip, String(record.attempts), String(banDuration)] });
    return true;
  }

  return false;
}

// =============================================================================
// 路由处理
// =============================================================================

function handleFavicon(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (req.method !== 'GET') return false;
  if (req.url !== '/favicon.ico' && req.url !== '/NeiLink.ico') return false;

  const faviconPath = path.join(__dirname, '../assets/NeiLink.ico');
  if (fs.existsSync(faviconPath)) {
    res.writeHead(200, {
      'Content-Type': 'image/x-icon',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(faviconPath).pipe(res);
  }
  return true;
}

function handleHomePage(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (req.method !== 'GET' || req.url !== '/') return false;
  const locale = getLocale(detectLanguage(req));
  sendHTML(res, 200, generateFileCodeInputHTML(locale));
  return true;
}

function handleFileCodePage(
  req: http.IncomingMessage,
  res: http.ServerResponse
): boolean {
  if (req.method !== 'GET' || !req.url || req.url.length <= 1 || req.url.startsWith('/api/')) {
    return false;
  }

  const fileCode = req.url.substring(1);
  const share = shares.get(fileCode);
  const locale = getLocale(detectLanguage(req));
  if (!share) {
    sendErrorPage(res, 404, locale.receiver.error.badFileCode, locale.receiver.error.badFileCodeMsg, undefined, locale);
    return true;
  }
  if (share.status !== 'active') {
    sendErrorPage(res, 410, locale.receiver.error.shareExpired, locale.receiver.error.shareExpiredMsg, undefined, locale);
    return true;
  }

  sendHTML(res, 200, generateReceiverHTML(toShareInfo(share), locale));
  return true;
}

function handleShareInfoAPI(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (req.method !== 'GET' || !req.url?.startsWith('/api/share-info/')) return false;

  const fileCode = req.url.substring('/api/share-info/'.length);
  const share = shares.get(fileCode);
  const locale = getLocale(detectLanguage(req));
  if (!share) {
    sendJSON(res, 404, { error: locale.receiver.error.shareNotExist });
    return true;
  }
  if (share.status !== 'active') {
    sendJSON(res, 410, { error: locale.receiver.error.shareExpired });
    return true;
  }

  sendJSON(res, 200, {
    fileName: share.fileName,
    fileSize: share.fileSize,
    isFolder: share.isFolder,
    uploaderName: share.uploaderName,
    hasExtractCode: !!share.extractCode,
    createdAt: share.createdAt,
    userAvatar: userSettings.userAvatar,
    userName: userSettings.userName,
  });
  return true;
}

function handleVerifyAPI(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (req.method !== 'POST' || !req.url?.startsWith('/api/verify/')) return false;

  const fileCode = req.url.substring('/api/verify/'.length);
  const share = shares.get(fileCode);
  const locale = getLocale(detectLanguage(req));
  if (!share) {
    sendJSON(res, 404, { error: locale.receiver.error.shareNotExist });
    return true;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      if (!share.extractCode) {
        sendJSON(res, 200, { success: true });
        return;
      }
      if (data.code === share.extractCode) {
        sendJSON(res, 200, { success: true });
      } else {
        sendJSON(res, 403, { success: false, error: locale.receiver.error.extractCodeIncorrect });
      }
    } catch {
      sendJSON(res, 400, { success: false, error: locale.receiver.error.invalidRequest });
    }
  });
  return true;
}

function handleDownloadAPI(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  clientIP: string
): boolean {
  if (req.method !== 'GET' || !req.url?.startsWith('/api/download/')) return false;

  const fileCode = req.url.substring('/api/download/'.length);
  const share = shares.get(fileCode);
  const locale = getLocale(detectLanguage(req));
  if (!share) {
    sendErrorPage(res, 404, locale.receiver.error.shareNotExist, locale.receiver.error.shareNotExistMsg, undefined, locale);
    return true;
  }
  if (!share.filePath || !fs.existsSync(share.filePath)) {
    sendErrorPage(res, 404, locale.receiver.error.fileNotExist, locale.receiver.error.fileNotExistMsg, undefined, locale);
    return true;
  }
  if (share.status !== 'active') {
    sendErrorPage(res, 410, locale.receiver.error.shareExpired, locale.receiver.error.shareExpiredMsg, undefined, locale);
    return true;
  }
  if (share.maxDownloads !== -1 && share.downloadCount >= share.maxDownloads) {
    sendErrorPage(res, 410, locale.receiver.error.maxDownloadsReached, locale.receiver.error.maxDownloadsReachedMsg, undefined, locale);
    return true;
  }

  // 下载完成回调
  res.on('finish', () => {
    share.downloadCount++;
    logger?.log(
      'download',
      `文件下载成功: ${share.fileName} (下载码: ${fileCode})，下载IP: ${clientIP}`,
      {
        detail: JSON.stringify({ fileSize: share.fileSize, shareId: share.id, fileName: share.fileName }),
        messageKey: 'download.complete',
        messageParams: [share.fileName, fileCode, clientIP],
      }
    );
    const cb = downloadCallbacks.get(fileCode);
    if (cb) cb(share.id);
  });

  const headers: http.OutgoingHttpHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(share.fileName)}"`,
  };

  // 流式传输逻辑
  try {
    if (share.isFolder) {
      res.writeHead(200, headers);
      const archive = archiver('zip', { zlib: { level: 1 } });
      const folderName = path.basename(share.filePath);
      archive.directory(share.filePath, folderName);
      archive.pipe(createThrottle()).pipe(res);
      archive.on('error', (err) => {
        if (!res.headersSent) {
          sendErrorPage(res, 500, locale.receiver.error.serverError, locale.receiver.error.archiveFailed, undefined, locale);
        }
        console.error('Archive error:', err);
      });
      archive.finalize();
    } else {
      const stat = fs.statSync(share.filePath);
      const fileSize = stat.size;
      let startByte = 0;
      let statusCode = 200;

      // 支持断点续传：解析 Range 请求头
      const rangeHeader = req.headers['range'];
      if (rangeHeader) {
        const match = String(rangeHeader).match(/^bytes=(\d+)-(\d*)$/);
        if (match) {
          startByte = parseInt(match[1], 10);
          if (isNaN(startByte) || startByte < 0) {
            startByte = 0;
          }
          if (startByte >= fileSize) {
            res.writeHead(416, {
              'Content-Range': `bytes */${fileSize}`,
              'Access-Control-Allow-Origin': '*',
            });
            res.end();
            return true;
          }
          statusCode = 206;
          const endByte = fileSize - 1;
          headers['Content-Range'] = `bytes ${startByte}-${endByte}/${fileSize}`;
        }
      }

      headers['Content-Length'] = fileSize - startByte;
      res.writeHead(statusCode, headers);
      const inputStream = fs.createReadStream(share.filePath, { start: startByte });
      inputStream.pipe(createThrottle()).pipe(res);
      inputStream.on('error', (err) => {
        if (!res.headersSent) {
          sendErrorPage(res, 500, locale.receiver.error.serverError, locale.receiver.error.fileReadFailed, undefined, locale);
        }
        console.error('File read error:', err);
      });
    }
  } catch (err) {
    if (!res.headersSent) {
      sendErrorPage(res, 500, locale.receiver.error.serverError, locale.receiver.error.transferFailed, undefined, locale);
    }
    console.error('Download error:', err);
  }

  return true;
}

// =============================================================================
// 服务器生命周期
// =============================================================================

export function startGlobalServer(
  port: number,
  settings?: {
    rateLimitEnabled?: boolean;
    rateLimitMaxAttempts?: number;
    rateLimitBanDuration?: number;
  }
): Promise<number> {
  return new Promise((resolve, reject) => {
    if (globalServer && globalServerPort) {
      resolve(globalServerPort);
      return;
    }

    if (settings) {
      rateLimitSettings = settings;
    }

    globalServer = http.createServer((req, res) => {
      const clientIP = getClientIP(req);

      // CORS 预检
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Range',
        });
        res.end();
        return;
      }

      // 静态资源 / 页面路由
      if (handleFavicon(req, res)) return;
      if (handleHomePage(req, res)) return;
      if (handleFileCodePage(req, res)) return;

      // 限流（在 API 路由之前）
      if (rateLimitSettings.rateLimitEnabled) {
        if (
          checkRateLimit(
            clientIP,
            rateLimitSettings.rateLimitMaxAttempts || 10,
            rateLimitSettings.rateLimitBanDuration || 30
          )
        ) {
          const rlLocale = getLocale(detectLanguage(req));
          sendErrorPage(res, 429, rlLocale.receiver.error.rateLimitTitle, rlLocale.receiver.error.rateLimitMsg, false, rlLocale);
          return;
        }
      }

      // API 路由
      if (handleShareInfoAPI(req, res)) return;
      if (handleVerifyAPI(req, res)) return;
      if (handleDownloadAPI(req, res, clientIP)) return;

      // 404
      const nfLocale = getLocale(detectLanguage(req));
      sendErrorPage(res, 404, nfLocale.receiver.error.pageNotFound, nfLocale.receiver.error.pageNotFoundMsg, undefined, nfLocale);
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

export function isServerRunning(): boolean {
  return globalServer !== null && globalServerPort !== null;
}

// =============================================================================
// 分享管理
// =============================================================================

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

export function unregisterShare(fileCode: string): void {
  shares.delete(fileCode);
  downloadCallbacks.delete(fileCode);
}

export function getGlobalServerPort(): number | null {
  return globalServerPort;
}

// =============================================================================
// 设置
// =============================================================================

export function setLogger(l: Logger): void {
  logger = l;
}

export function updateUserSettings(settings: Partial<SystemSettings>): void {
  userSettings = { ...userSettings, ...settings };
}

export function getUserSettings(): Partial<SystemSettings> {
  return { ...userSettings };
}

export function updateRateLimitSettings(settings: {
  rateLimitEnabled?: boolean;
  rateLimitMaxAttempts?: number;
  rateLimitBanDuration?: number;
}): void {
  rateLimitSettings = { ...rateLimitSettings, ...settings };
}

export function updateSpeedLimit(kbps: number): void {
  downloadSpeedLimit = kbps;
}

// =============================================================================
// 封禁 IP 管理
// =============================================================================

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
    logger?.log('system', `解封IP: ${ip}`, { messageKey: 'bannedIP.unban', messageParams: [ip] });
    return true;
  }
  return false;
}

export function updateBanDuration(ip: string, durationMinutes: number): boolean {
  const record = rateLimitRecords.get(ip);
  if (record && record.banned) {
    record.banExpiry = Date.now() + durationMinutes * 60 * 1000;
    logger?.log('system', `更新封禁时长: ${ip} -> ${durationMinutes}分钟`, { messageKey: 'bannedIP.updateDuration', messageParams: [ip, String(durationMinutes)] });
    return true;
  }
  return false;
}

// =============================================================================
// 向后兼容
// =============================================================================

export function createServer(): Promise<number> {
  return Promise.resolve(globalServerPort || 3000);
}

export function stopServer(): Promise<void> {
  return Promise.resolve();
}

export function stopAllServers(): Promise<void> {
  return stopGlobalServer();
}
