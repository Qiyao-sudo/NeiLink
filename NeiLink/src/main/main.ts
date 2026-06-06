/**
 * NeiLink 主进程入口
 * 初始化所有服务模块并启动应用
 */

import { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as cron from 'node-cron';
import { IPC_CHANNELS } from '../shared/types';
import { NetworkMonitor, initializeNetwork } from './services/network';
import { Logger } from './services/logger';
import { SettingsManager } from './services/settings';
import { ShareManager } from './services/shareManager';
import { registerIpcHandlers } from './ipcHandlers';
import { setLogger, updateUserSettings } from './services/httpServer';
import { initializeHotspot } from './services/hotspot';

let mainWindow: BrowserWindow | null = null;
let floatWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let settingsManager: SettingsManager | null = null;
let shareManager: ShareManager | null = null;
let networkMonitor: NetworkMonitor | null = null;

function getTrayLabels(lang: string) {
  if (lang === 'en-US') {
    return { share: 'Share', shares: 'Share Management', settings: 'Settings', exit: 'Exit' };
  }
  return { share: '分享', shares: '分享管理', settings: '设置', exit: '退出应用' };
}

function rebuildTrayMenu(language?: string): void {
  if (!tray) return;
  const lang = language || 'zh-CN';
  const labels = getTrayLabels(lang);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: labels.share,
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: labels.shares,
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send(IPC_CHANNELS.WINDOW_NAVIGATE, '/shares');
        }
      },
    },
    {
      label: labels.settings,
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send(IPC_CHANNELS.WINDOW_NAVIGATE, '/settings');
        }
      },
    },
    { type: 'separator' },
    {
      label: labels.exit,
      click: () => {
        if (tray) {
          tray.destroy();
          tray = null;
        }
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
}

/**
 * 创建主窗口
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'NeiLink',
    show: false,
    frame: false, // 取消标题栏
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 开发环境加载 webpack-dev-server，生产环境加载打包后的文件
  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // 修正路径，直接指向 dist/renderer/index.html
    const indexPath = path.join(__dirname, '..', 'renderer', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('close', async (e) => {
    if (!settingsManager) return;

    const settings = await settingsManager.getSettings();
    const behavior = settings.closeBehavior || 'ask';

    if (behavior === 'minimize') {
      e.preventDefault();
      mainWindow?.hide();
    } else if (behavior === 'ask') {
      e.preventDefault();
      if (mainWindow?.isMinimized()) mainWindow.restore();
      mainWindow?.show();
      mainWindow?.focus();
      mainWindow?.webContents.send(IPC_CHANNELS.WINDOW_CLOSE_ACTION, 'ask');
    }
  });

  mainWindow.on('closed', () => {
    if (tray) {
      tray.destroy();
      tray = null;
    }
    mainWindow = null;
  });

  // 创建系统托盘
  const iconPath = path.join(__dirname, 'assets', 'NeiLink.ico');
  let trayIcon = nativeImage.createFromPath(iconPath);
  if (trayIcon.isEmpty()) {
    trayIcon = nativeImage.createEmpty();
  }
  tray = new Tray(trayIcon);
  tray.setToolTip('NeiLink');

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  rebuildTrayMenu();
}

/**
 * 创建桌面悬浮窗
 */
function createFloatWindow(): void {
  const isDev = !app.isPackaged;

  floatWindow = new BrowserWindow({
    width: 84,
    height: 84,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  floatWindow.setVisibleOnAllWorkspaces(true);
  floatWindow.setAlwaysOnTop(true, 'floating');

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;
  floatWindow.setPosition(width - 100, 100);

  if (isDev) {
    floatWindow.loadURL('http://localhost:3000/float');
  } else {
    floatWindow.loadFile(path.join(__dirname, '..', 'renderer', 'float.html'));
  }

  floatWindow.on('closed', () => {
    floatWindow = null;
  });
}

/**
 * 关闭悬浮窗
 */
function closeFloatWindow(): void {
  if (floatWindow && !floatWindow.isDestroyed()) {
    floatWindow.close();
    floatWindow = null;
  }
}

/**
 * 初始化所有服务模块
 */
async function initializeServices(): Promise<void> {
  const userDataPath = app.getPath('userData');

  // 1. 初始化设置管理器
  settingsManager = new SettingsManager(userDataPath);
  await settingsManager.initialize();
  const settings = await settingsManager.getSettings();

  // 托盘菜单语言同步
  rebuildTrayMenu(settings.language);

  // 2. 初始化日志系统
  const logger = new Logger(settings.logStoragePath);
  logger.log('system', 'NeiLink 应用启动', {
    detail: `版本: ${app.getVersion()}, 平台: ${process.platform}`,
    messageKey: 'app.startup',
  });
  
  // 设置 httpServer 的 logger
  setLogger(logger);
  
  // 设置 httpServer 的用户设置
  updateUserSettings({
    userName: settings.userName,
    userAvatar: settings.userAvatar
  });

  // 2.5 初始化网络模块，加载用户选择的适配器
  await initializeNetwork(settingsManager, logger);

  // 2.6 初始化热点模块
  initializeHotspot(logger);

  // 3. 初始化网络监控
  networkMonitor = new NetworkMonitor((info) => {
    // 网络变化时推送通知到渲染进程
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.NETWORK_ON_CHANGE, info);
    }
  });

  // 4. 初始化分享管理器
  const tempDir = path.join(userDataPath, 'temp');
  shareManager = new ShareManager(logger, tempDir, settings);
  shareManager.startExpiryCheck();

  // 5. 注册 IPC 处理器
  registerIpcHandlers(mainWindow!, logger, settingsManager, shareManager, networkMonitor, (lang) => rebuildTrayMenu(lang));

  ipcMain.handle(IPC_CHANNELS.FLOAT_TOGGLE, async (_event, enabled: boolean) => {
    if (enabled) {
      if (!floatWindow || floatWindow.isDestroyed()) {
        createFloatWindow();
      }
    } else {
      closeFloatWindow();
    }
    return { success: true };
  });

  ipcMain.on(IPC_CHANNELS.FLOAT_MOVE, (_event, { dx, dy }: { dx: number; dy: number }) => {
    if (floatWindow && !floatWindow.isDestroyed()) {
      const [x, y] = floatWindow.getPosition();
      const [w, h] = floatWindow.getSize();
      const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      const { x: wx, y: wy, width: ww, height: wh } = display.workArea;
      const newX = Math.max(wx, Math.min(wx + ww - w, Math.round(x + dx)));
      const newY = Math.max(wy, Math.min(wy + wh - h, Math.round(y + dy)));
      floatWindow.setPosition(newX, newY);
    }
  });

  // 6. 启动日志清理定时任务（每天凌晨3点执行）
  cron.schedule('0 3 * * *', () => {
    if (!settingsManager) return;
    const currentSettings = settingsManager.getSettings();
    currentSettings.then((s) => {
      const removedCount = logger.cleanupOldLogs(s.logRetentionDays);
      if (removedCount > 0) {
        logger.log('system', '日志清理完成', {
          detail: `清理了 ${removedCount} 条过期日志`,
          messageKey: 'log.cleanup.complete',
        });
      }
    });
  });

  // 7. 启动时执行一次日志清理
  const removedCount = logger.cleanupOldLogs(settings.logRetentionDays);
  if (removedCount > 0) {
    logger.log('system', '启动时清理过期日志', {
      detail: `清理了 ${removedCount} 条过期日志`,
      messageKey: 'log.cleanup.onStartup',
    });
  }

  logger.log('system', '所有服务初始化完成', { messageKey: 'services.init.complete' });
}

/**
 * 清理资源
 */
async function cleanup(): Promise<void> {
  if (shareManager) {
    await shareManager.destroy();
    shareManager = null;
  }
  if (networkMonitor) {
    networkMonitor.stop();
    networkMonitor = null;
  }
}

// ==================== 应用生命周期 ====================

// 注册本地资源协议（提供视频等静态资源给渲染进程）
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-asset',
    privileges: {
      bypassCSP: true,
      stream: true,
      supportFetchAPI: true,
    },
  },
]);

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      // 注册本地资源协议处理器（支持 Range 请求，用于视频播放）
      protocol.handle('local-asset', (request) => {
        const assetsDir = path.resolve(path.join(__dirname, 'assets'));
        const fileName = request.url.replace('local-asset://', '');
        const decodedFileName = decodeURIComponent(fileName);
        const filePath = path.resolve(path.join(assetsDir, decodedFileName));

        // 防止路径遍历：确保解析后的路径在 assetsDir 内
        if (!filePath.startsWith(assetsDir + path.sep) && filePath !== assetsDir) {
          return new Response('Forbidden', { status: 403 });
        }

        try {
          const stat = fs.statSync(filePath);
          const fileSize = stat.size;

          const rangeHeader = request.headers.get('range');
          if (rangeHeader) {
            const parts = rangeHeader.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = end - start + 1;

            const fileStream = fs.createReadStream(filePath, { start, end });
            return new Response(fileStream as any, {
              status: 206,
              headers: {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': String(chunkSize),
                'Content-Type': 'video/mp4',
              },
            });
          }

          const fileStream = fs.createReadStream(filePath);
          return new Response(fileStream as any, {
            status: 200,
            headers: {
              'Content-Length': String(fileSize),
              'Content-Type': 'video/mp4',
              'Accept-Ranges': 'bytes',
            },
          });
        } catch {
          return new Response('Not Found', { status: 404 });
        }
      });

      createWindow();
    await initializeServices();

    const settings = await settingsManager!.getSettings();
    if (settings.floatWindowEnabled !== false) {
      createFloatWindow();
    }
    } catch (err) {
      console.error('应用初始化失败:', err);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', async () => {
  await cleanup();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await cleanup();
});
