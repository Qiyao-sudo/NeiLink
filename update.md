# NeiLink 检查更新功能

## 架构概览

```
renderer (AboutPage.tsx)        preload.ts        ipcHandlers.ts        updater.ts        GitHub API
─────────────────────────       ──────────        ──────────────        ──────────        ──────────
                               invoke whitelist   ipcMain.handle
User clicks [检查更新] ──→ invoke('app:check-update') ──→ handler ──→ checkForUpdates() ──→ GET /repos/.../releases/latest
                                     │                                        │
                              ◄── Promise<UpdateInfo> ◄───────────────────────┘
  setUpdateInfo(result)
  渲染更新结果
```

## 文件职责

| 文件 | 职责 |
|------|------|
| `src/shared/types.ts` | 定义 `UpdateInfo` 接口和 `IPC_CHANNELS.APP_CHECK_UPDATE` / `APP_GET_VERSION` 通道常量 |
| `src/preload/preload.ts` | 内联定义 IPC 通道白名单（preload 不可 import TS 模块，故直接 define），`invokeChannels` 数组放行 `app:check-update` |
| `src/main/services/updater.ts` | 核心逻辑：版本获取、GitHub API 请求、semver 比较 |
| `src/main/ipcHandlers.ts` | 注册 `ipcMain.handle('app:check-update', ...)` 和 `app:get-version` |
| `src/renderer/pages/AboutPage.tsx` | 用户界面：按钮触发 → `invoke` → 展示结果 |

## 数据流

### 1. 获取当前版本

```
AboutPage.tsx                     ipcHandlers.ts              updater.ts
────────────                      ──────────────              ──────────
useEffect(() => {
  invoke('app:get-version')  ──→  handler  ──→  return app.getVersion()
  .then(v => setAppVersion(v))                                  ↑
})                                                      Electron app API
```

- 使用 Electron 内置 `app.getVersion()` 读取 `package.json` 的 `version` 字段
- 当前版本号：`1.3.0`

### 2. 检查更新

```
AboutPage.tsx                          updater.ts                          GitHub
────────────                          ──────────                          ──────
handleCheckUpdate() {
  setChecking(true)
                                       https.get(url, headers)
  invoke('app:check-update')  ──→        │
                                         ▼
                                      解析 JSON:
                                      - tag_name → latestVersion
                                      - body     → releaseNotes
                                      - html_url → downloadUrl
                                         │
                                         ▼
                                      compareVersions(current, latest)
                                      → 逐段比较 1.3.0 vs 1.4.0
                                         │
                                         ▼
                               ←──  return { hasUpdate, currentVersion,
                                            latestVersion, downloadUrl,
                                            releaseNotes }
  setUpdateInfo(result) ◄──
  渲染: hasUpdate ? 绿色提示+下载按钮
                  : "已是最新版本"
}
```

### 3. 版本比较算法

```typescript
function compareVersions(current: string, latest: string): boolean {
  // "1.3.0" vs "1.4.0"
  const cur = [1, 3, 0]
  const lat = [1, 4, 0]
  // 逐段比较：1==1, 4>3 → 返回 true (有新版本)
}
```

- 简单的 semver 字符串比较，无外部依赖
- `tag_name` 自动去除 `v` 前缀（`v1.4.0` → `1.4.0`）

## API 请求

**URL**: `https://api.github.com/repos/Qiyao-sudo/NeiLink/releases/latest`

**Headers**: `{ 'User-Agent': 'NeiLink' }`（GitHub API 要求）

**Response**:
```json
{
  "tag_name": "v1.4.0",
  "html_url": "https://github.com/Qiyao-sudo/NeiLink/releases/tag/v1.4.0",
  "body": "## What's Changed\r\n- 新增限速功能\r\n- 修复断点续传bug"
}
```

## 错误处理

- 网络请求失败 → `catch` 静默，`hasUpdate` 保持 `false`，UI 显示 `message.error('检查更新失败')`
- GitHub API 限流（未认证 60次/小时）→ 本地局域网使用场景无影响
- 非标准版本号格式 → `parseInt('abc') = NaN`，比较时 fallback 为 `0`

## UI 状态机

```
[检查更新]
    │ 点击
    ▼
[正在检查...] (loading spinner)
    │
    ├─ hasUpdate=true ──→ [绿色卡片：新版本号 + Release Notes + "前往下载"按钮]
    │                           │ 点击下载
    │                           ▼
    │                    window.open(downloadUrl) → 系统浏览器打开 GitHub Releases
    │
    └─ hasUpdate=false ──→ [绿色 Tag: "已是最新版本"]
```
