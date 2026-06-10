import { app } from 'electron';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { UpdateInfo, UpdateAsset } from '../../shared/types';

const REPO_OWNER = 'Qiyao-sudo';
const REPO_NAME = 'NeiLink';

// ==================== 下载状态机 ====================

type Phase = 'idle' | 'downloading' | 'paused' | 'done';

interface Context {
  url: string;            // 重定向后的最终 URL
  destPath: string;       // 临时文件路径
  tmpDir: string;         // 临时目录
  asset: UpdateAsset;
  totalBytes: number;
  receivedBytes: number;
  sender: Electron.WebContents;
}

let phase: Phase = 'idle';
let ctx: Context | null = null;
let abortCtrl: AbortController | null = null;   // 用于取消当前请求

// ==================== 工具函数 ====================

function compareVersions(current: string, latest: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const cur = parse(current);
  const lat = parse(latest);
  for (let i = 0; i < Math.max(cur.length, lat.length); i++) {
    const c = cur[i] || 0;
    const l = lat[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'NeiLink' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error('Failed to parse response')); }
      });
    }).on('error', reject);
  });
}

/** 跟随重定向获取最终直链 URL */
function resolveUrl(url: string, maxRedirects = 10): Promise<string> {
  return new Promise((resolve, reject) => {
    const follow = (current: string, count: number) => {
      if (count > maxRedirects) { reject(new Error('Too many redirects')); return; }
      const proto = current.startsWith('https') ? https : http;
      proto.get(current, { method: 'HEAD', headers: { 'User-Agent': 'NeiLink' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, current).toString();
          follow(next, count + 1);
        } else {
          resolve(current);
        }
        res.resume();
      }).on('error', reject);
    };
    follow(url, 0);
  });
}

function matchAsset(assets: UpdateAsset[]): UpdateAsset | null {
  const platform = process.platform;
  const arch = process.arch;
  const patterns: Record<string, RegExp> = {
    win32: new RegExp(`-windows-${arch}-installation\\.tar\\.gz$`),
    darwin: new RegExp(`-mac-${arch}-installation\\.tar\\.gz$`),
    linux: new RegExp(`-linux-${arch}-installation\\.tar\\.gz$`),
  };
  const re = patterns[platform];
  return re ? assets.find(a => re.test(a.name)) || null : null;
}

function extractTarGz(tarGzPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(process.platform === 'win32' ? 'tar.exe' : 'tar', ['xzf', tarGzPath, '-C', destDir], (err) => {
      err ? reject(err) : resolve();
    });
  });
}

/** 真正执行一段下载（从 startByte 开始），可被 abortCtrl 取消 */
function downloadSegment(
  url: string,
  destPath: string,
  startByte: number,
  totalKnown: number,
  signal: AbortSignal,
  onProgress: (received: number, total: number) => void,
): Promise<number> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('cancelled')); return; }

    const headers: Record<string, string> = { 'User-Agent': 'NeiLink' };
    if (startByte > 0) headers['Range'] = `bytes=${startByte}-`;

    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { headers }, (res) => {
      // 重定向
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const next = res.headers.location!.startsWith('http')
          ? res.headers.location!
          : new URL(res.headers.location!, url).toString();
        downloadSegment(next, destPath, startByte, totalKnown, signal, onProgress)
          .then(resolve).catch(reject);
        return;
      }

      const expected = startByte > 0 ? 206 : 200;
      if (res.statusCode !== expected) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const realTotal = parseInt(
        res.headers['content-range']?.split('/')[1] || res.headers['content-length'] || '0', 10,
      ) || totalKnown;

      // 追加写入
      const ws = fs.createWriteStream(destPath, startByte > 0 ? { flags: 'a' } : {});
      let received = startByte;

      res.on('data', (chunk: Buffer) => {
        received += chunk.length;
        onProgress(received, realTotal);
      });

      res.pipe(ws);
      ws.on('finish', () => { ws.close(); resolve(realTotal); });
      ws.on('error', reject);

      // 取消信号 → 销毁响应，promise reject
      const onAbort = () => {
        res.destroy(new Error('cancelled'));
        ws.destroy();
      };
      signal.addEventListener('abort', onAbort, { once: true });
      res.on('close', () => { signal.removeEventListener('abort', onAbort); });
    });

    req.on('error', reject);

    // 请求阶段也要监听取消
    const onAbortReq = () => { req.destroy(); };
    signal.addEventListener('abort', onAbortReq, { once: true });
    req.on('close', () => { signal.removeEventListener('abort', onAbortReq); });
  });
}

/** 下载完成后的安装流程 */
async function installDownloaded(context: Context): Promise<void> {
  await extractTarGz(context.destPath, context.tmpDir);

  const setupExe = fs.readdirSync(context.tmpDir).find(f => f.toLowerCase().endsWith('.exe'));
  if (!setupExe) throw new Error('未找到安装程序');

  const setupPath = path.join(context.tmpDir, setupExe);

  if (process.platform === 'win32') {
    execFile(setupPath, ['/VERYSILENT', '/NORESTART'], (error) => {
      if (error) context.sender.send('update:download-progress', -1);
    });
  } else {
    fs.chmodSync(setupPath, 0o755);
    execFile(setupPath, [], (error) => {
      if (error) context.sender.send('update:download-progress', -1);
    });
  }

  setTimeout(() => { app.quit(); }, 1000);
}

/** 清理临时文件 */
function cleanupTmp() {
  if (ctx?.tmpDir) {
    try { fs.rmSync(ctx.tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ==================== 导出 API ====================

export function getAppVersion(): string {
  return app.getVersion();
}

export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = app.getVersion();
  const result: UpdateInfo = {
    hasUpdate: false,
    currentVersion,
    latestVersion: currentVersion,
    downloadUrl: '',
    releaseNotes: '',
    assets: [],
  };

  try {
    const release = await fetchJSON(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
    );
    const tagName: string = release.tag_name || '';
    const latestVersion = tagName.replace(/^v/, '');
    result.latestVersion = latestVersion;
    result.releaseNotes = release.body || '';
    result.downloadUrl = release.html_url || `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
    result.assets = (release.assets || []).map((a: any) => ({
      name: a.name,
      browser_download_url: a.browser_download_url,
    }));
    result.hasUpdate = compareVersions(currentVersion, latestVersion);
  } catch { /* hasUpdate stays false */ }

  return result;
}

/** 开始下载（仅能从 idle 调用） */
export async function startDownload(
  assets: UpdateAsset[],
  event: Electron.IpcMainInvokeEvent,
): Promise<void> {
  if (phase !== 'idle') return;

  const asset = matchAsset(assets);
  if (!asset) throw new Error('未找到适用于当前平台的安装包');

  // 解析最终直链
  const resolvedUrl = await resolveUrl(asset.browser_download_url);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neilink-update-'));
  const destPath = path.join(tmpDir, asset.name);

  ctx = {
    url: resolvedUrl,
    destPath,
    tmpDir,
    asset,
    totalBytes: 0,
    receivedBytes: 0,
    sender: event.sender,
  };

  // 开始下载循环
  await runDownloadLoop();
}

/** 核心下载循环：下载 → 可暂停 → 可继续 → 直到完成 */
async function runDownloadLoop(): Promise<void> {
  if (!ctx) return;

  phase = 'downloading';
  abortCtrl = new AbortController();

  try {
    const total = await downloadSegment(
      ctx.url,
      ctx.destPath,
      ctx.receivedBytes,
      ctx.totalBytes,
      abortCtrl.signal,
      (received, total) => {
        if (ctx) {
          ctx.receivedBytes = received;
          ctx.totalBytes = total;
        }
        if (total > 0) {
          ctx?.sender.send('update:download-progress', Math.round((received / total) * 100));
        }
      },
    );

    // 下载完成
    if (ctx) ctx.totalBytes = total;
    phase = 'done';
    ctx?.sender.send('update:download-progress', 100);

    // 安装
    if (ctx) await installDownloaded(ctx);
  } catch (err: any) {
    if ((phase as string) === 'paused') {
      // 暂停引起的中断，正常返回，等待 resumeDownload 重新调用本函数
      return;
    }
    // 真正的错误或取消
    phase = 'idle';
    cleanupTmp();
    ctx = null;
    if (err.message !== 'cancelled') {
      throw err;
    }
  }
}

/** 暂停 */
export function pauseDownload(): boolean {
  if (phase !== 'downloading' || !abortCtrl) return false;
  phase = 'paused';
  abortCtrl.abort();  // 触发 cancel → doDownload promise reject
  return true;
}

/** 继续 */
export async function resumeDownload(event: Electron.IpcMainInvokeEvent): Promise<void> {
  if (phase !== 'paused' || !ctx) return;
  if (ctx.sender.isDestroyed()) return;
  ctx.sender = event.sender;

  // 重新发起下载循环（从 receivedBytes 继续）
  await runDownloadLoop();
}

/** 取消 */
export function cancelDownload(): boolean {
  if (phase === 'idle') return false;

  const wasPaused = phase === 'paused';
  phase = 'idle';

  // 如果正在下载中，abort 让请求中断
  if (abortCtrl) {
    abortCtrl.abort();
    abortCtrl = null;
  }

  cleanupTmp();
  ctx = null;
  return true;
}
