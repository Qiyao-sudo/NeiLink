import { app } from 'electron';
import * as https from 'https';
import { UpdateInfo } from '../../shared/types';

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

    result.hasUpdate = compareVersions(currentVersion, latestVersion);
  } catch {
    // 检查失败时 hasUpdate 保持 false
  }

  return result;
}
