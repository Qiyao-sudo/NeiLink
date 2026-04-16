/**
 * HTTP 文件服务器模块
 * 为每个分享任务创建独立的 HTTP 服务器，支持断点续传和限流
 */

import * as http from 'http';
import * as fs from 'fs';
import { ShareConfig } from '../../shared/types';
import { generateReceiverHTML, generateFileCodeInputHTML, ShareInfo } from './receiverPage';

/** 限流记录 */
interface RateLimitRecord {
  attempts: number;
  firstAttempt: number;
  banned: boolean;
  banExpiry: number;
}

/** 服务器实例存储 */
const servers: Map<number, http.Server> = new Map();

/** 限流记录存储（IP -> 记录） */
const rateLimitRecords: Map<string, RateLimitRecord> = new Map();

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
  let record = rateLimitRecords.get(ip);

  if (!record) {
    record = { attempts: 0, firstAttempt: now, banned: false, banExpiry: 0 };
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
    record.firstAttempt = now;
  }

  // 增加访问计数
  record.attempts++;

  // 检查是否超过最大尝试次数
  if (record.attempts > maxAttempts) {
    record.banned = true;
    record.banExpiry = now + banDuration * 60 * 1000;
    return true;
  }

  return false;
}

/**
 * 获取客户端 IP 地址
 */
function getClientIP(req: http.IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
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
 * 为分享任务创建 HTTP 服务器
 * @param shareConfig 分享配置
 * @param onDownload 下载完成回调
 * @param settings 限流设置
 */
export function createServer(
  shareConfig: ShareConfig,
  onDownload?: (shareId: string) => void,
  settings?: {
    rateLimitEnabled?: boolean;
    rateLimitMaxAttempts?: number;
    rateLimitBanDuration?: number;
  }
): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
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

      // 限流检查（仅对 API 路由生效）
      if (settings?.rateLimitEnabled && req.url?.startsWith('/api/')) {
        const isLimited = checkRateLimit(
          clientIP,
          settings.rateLimitMaxAttempts || 10,
          settings.rateLimitBanDuration || 30
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
        if (fileCode === shareConfig.id) {
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

      if (req.method === 'GET' && req.url === '/api/share-info') {
        // 返回分享信息（不含提取码和密钥）
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
        });
        return;
      }

      if (req.method === 'POST' && req.url === '/api/verify') {
        // 验证提取码
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

      if (req.method === 'GET' && req.url === '/api/download') {
        // 文件下载（支持断点续传）
        const filePath = shareConfig.encryptedFilePath || shareConfig.filePath;

        if (!filePath || !fs.existsSync(filePath)) {
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

        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = parseRange(req.headers.range, fileSize);

        const headers: http.OutgoingHttpHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Accept-Ranges': 'bytes',
        };

        if (range) {
          // 断点续传 - 返回 206 Partial Content
          headers['Content-Range'] = `bytes ${range.start}-${range.end}/${fileSize}`;
          headers['Content-Length'] = range.end - range.start + 1;
          headers['Content-Type'] = 'application/octet-stream';

          res.writeHead(206, headers);

          const stream = fs.createReadStream(filePath, { start: range.start, end: range.end });
          stream.pipe(res);
        } else {
          // 完整下载 - 返回 200
          headers['Content-Length'] = fileSize;
          headers['Content-Type'] = 'application/octet-stream';
          headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(shareConfig.fileName)}"`;

          res.writeHead(200, headers);

          const stream = fs.createReadStream(filePath);
          stream.pipe(res);
        }

        // 下载完成后更新计数
        res.on('finish', () => {
          shareConfig.downloadCount++;
          if (onDownload) {
            onDownload(shareConfig.id);
          }
        });
        return;
      }

      // 404
      sendJSON(res, 404, { error: '未找到请求的资源' });
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`端口 ${shareConfig.port} 已被占用`));
      } else {
        reject(new Error(`服务器启动失败: ${err.message}`));
      }
    });

    server.listen(shareConfig.port, '0.0.0.0', () => {
      servers.set(shareConfig.port, server);
      resolve(shareConfig.port);
    });
  });
}

/**
 * 停止指定端口的服务器
 */
export function stopServer(port: number): Promise<void> {
  return new Promise((resolve) => {
    const server = servers.get(port);
    if (!server) {
      resolve();
      return;
    }

    server.close(() => {
      servers.delete(port);
      resolve();
    });

    // 清理该服务器相关的限流记录
    // （简单实现：保留所有限流记录，由超时机制自动清理）
  });
}

/**
 * 停止所有服务器
 */
export async function stopAllServers(): Promise<void> {
  const ports = Array.from(servers.keys());
  await Promise.all(ports.map((port) => stopServer(port)));
}

/**
 * 检查指定端口是否有服务器在运行
 */
export function isServerRunning(port: number): boolean {
  return servers.has(port);
}
