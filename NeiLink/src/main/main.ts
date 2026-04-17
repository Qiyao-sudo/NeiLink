/**
 * NeiLink 主进程入口
 * 初始化所有服务模块并启动应用
 */

import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as cron from 'node-cron';
import { IPC_CHANNELS } from '../shared/types';
import { NetworkMonitor } from './services/network';
import { Logger } from './services/logger';
import { SettingsManager } from './services/settings';
import { ShareManager } from './services/shareManager';
import { registerIpcHandlers } from './ipcHandlers';
import { setLogger } from './services/httpServer';

let mainWindow: BrowserWindow | null = null;
let shareManager: ShareManager | null = null;
let networkMonitor: NetworkMonitor | null = null;

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
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 开发环境加载 webpack-dev-server，生产环境加载打包后的文件
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * 初始化所有服务模块
 */
async function initializeServices(): Promise<void> {
  const userDataPath = app.getPath('userData');

  // 1. 初始化设置管理器
  const settingsManager = new SettingsManager(userDataPath);
  await settingsManager.initialize();
  const settings = await settingsManager.getSettings();

  // 2. 初始化日志系统
  const logger = new Logger(settings.logStoragePath);
  logger.log('system', 'NeiLink 应用启动', `版本: ${app.getVersion()}, 平台: ${process.platform}`);
  
  // 设置 httpServer 的 logger
  setLogger(logger);

  // 3. 初始化网络监控
  networkMonitor = new NetworkMonitor((info) => {
    logger.log('system', '网络状态变化', `IP: ${info.ip}, 类型: ${info.type}, 在线: ${info.isOnline}`);
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
  registerIpcHandlers(mainWindow!, logger, settingsManager, shareManager, networkMonitor);

  // 6. 启动日志清理定时任务（每天凌晨3点执行）
  cron.schedule('0 3 * * *', () => {
    const currentSettings = settingsManager.getSettings();
    currentSettings.then((s) => {
      const removedCount = logger.cleanupOldLogs(s.logRetentionDays);
      if (removedCount > 0) {
        logger.log('system', `日志清理完成`, `清理了 ${removedCount} 条过期日志`);
      }
    });
  });

  // 7. 启动时执行一次日志清理
  const removedCount = logger.cleanupOldLogs(settings.logRetentionDays);
  if (removedCount > 0) {
    logger.log('system', `启动时清理过期日志`, `清理了 ${removedCount} 条过期日志`);
  }

  logger.log('system', '所有服务初始化完成');
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

app.whenReady().then(async () => {
  try {
    createWindow();
    await initializeServices();
  } catch (err) {
    console.error('应用初始化失败:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  await cleanup();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await cleanup();
});
