import { app, BrowserWindow } from 'electron';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { UpdateInfo, UpdateAsset } from '../../shared/types';

const REPO_OWNER = 'Qiyao-sudo';
const REPO_NAME = 'NeiLink';

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
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Failed to parse response'));
        }
      });
    }).on('error', reject);
  });
}

function downloadFile(url: string, destPath: string, onProgress?: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = (currentUrl: string, redirectCount = 0) => {
      if (redirectCount > 10) {
        reject(new Error('Too many redirects'));
        return;
      }
      protocol.get(currentUrl, { headers: { 'User-Agent': 'NeiLink' } }, (res) => {
        // 处理重定向 (GitHub release assets use 302 redirects)
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          request(res.headers.location, redirectCount + 1);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed with status ${res.statusCode}`));
          return;
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        const stream = fs.createWriteStream(destPath);
        res.on('data', (chunk: Buffer) => {
          received += chunk.length;
          if (total > 0 && onProgress) {
            onProgress(Math.round((received / total) * 100));
          }
        });
        res.pipe(stream);
        stream.on('finish', () => {
          stream.close();
          resolve();
        });
        stream.on('error', reject);
        res.on('error', reject);
      }).on('error', reject);
    };
    request(url);
  });
}

function matchAsset(assets: UpdateAsset[]): UpdateAsset | null {
  const platform = process.platform; // 'win32' | 'darwin' | 'linux'
  const arch = process.arch; // 'x64' | 'arm64'

  if (platform === 'win32') {
    // 匹配 NeiLink-{V}-windows-{arch}-installation.tar.gz
    const pattern = new RegExp(`-windows-${arch}-installation\\.tar\\.gz$`);
    return assets.find(a => pattern.test(a.name)) || null;
  }
  if (platform === 'darwin') {
    const pattern = new RegExp(`-mac-${arch}-installation\\.tar\\.gz$`);
    return assets.find(a => pattern.test(a.name)) || null;
  }
  if (platform === 'linux') {
    const pattern = new RegExp(`-linux-${arch}-installation\\.tar\\.gz$`);
    return assets.find(a => pattern.test(a.name)) || null;
  }
  return null;
}

function extractTarGz(tarGzPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Windows 上使用 tar 命令（Windows 10+ 自带），其他平台同理
    const cmd = process.platform === 'win32' ? 'tar.exe' : 'tar';
    execFile(cmd, ['xzf', tarGzPath, '-C', destDir], (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

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
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`
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
  } catch {
    // 检查失败时 hasUpdate 保持 false
  }

  return result;
}

export async function downloadAndInstall(
  assets: UpdateAsset[],
  event: Electron.IpcMainInvokeEvent
): Promise<void> {
  const asset = matchAsset(assets);
  if (!asset) {
    throw new Error('未找到适用于当前平台的安装包');
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neilink-update-'));
  const archivePath = path.join(tmpDir, asset.name);

  // 下载安装包
  await downloadFile(asset.browser_download_url, archivePath, (percent) => {
    event.sender.send('update:download-progress', percent);
  });

  // 解压
  await extractTarGz(archivePath, tmpDir);

  // 查找安装程序
  const setupExe = fs.readdirSync(tmpDir).find(f => f.toLowerCase().endsWith('.exe'));
  if (!setupExe) {
    throw new Error('未找到安装程序');
  }

  const setupPath = path.join(tmpDir, setupExe);

  // 静默安装并退出应用
  if (process.platform === 'win32') {
    execFile(setupPath, ['/VERYSILENT', '/NORESTART'], (error) => {
      if (error) {
        event.sender.send('update:download-progress', -1);
      }
    });
  } else {
    // macOS / Linux：赋予执行权限后运行
    fs.chmodSync(setupPath, 0o755);
    execFile(setupPath, [], (error) => {
      if (error) {
        event.sender.send('update:download-progress', -1);
      }
    });
  }

  // 延迟退出，确保安装程序已启动
  setTimeout(() => {
    app.quit();
  }, 1000);
}
