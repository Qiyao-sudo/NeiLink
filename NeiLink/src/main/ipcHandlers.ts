/**
 * IPC 处理器
 * 注册所有 IPC 通信通道的处理函数
 */

import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { IPC_CHANNELS, ShareConfig, SystemSettings, LogEntry } from '../shared/types';
import { getNetworkInfo, isPortAvailable, findAvailablePort, NetworkMonitor, getIPByAdapterName, setSelectedAdapterName } from './services/network';
import { Logger } from './services/logger';
import { SettingsManager } from './services/settings';
import { ShareManager, CreateShareParams } from './services/shareManager';
import * as hotspot from './services/hotspot';
import * as httpServer from './services/httpServer';
import * as updater from './services/updater';

/**
 * 注册所有 IPC 处理器
 *
 * @param mainWindow 主窗口实例
 * @param logger 日志记录器
 * @param settingsManager 设置管理器
 * @param shareManager 分享管理器
 * @param networkMonitor 网络监控器
 */
export function registerIpcHandlers(
  mainWindow: BrowserWindow,
  logger: Logger,
  settingsManager: SettingsManager,
  shareManager: ShareManager,
  networkMonitor: NetworkMonitor
): void {

  // ==================== 网络相关 ====================

  // 获取网络信息
  ipcMain.handle(IPC_CHANNELS.NETWORK_GET_INFO, async () => {
    try {
      const networkInfo = getNetworkInfo();
      return { success: true, data: networkInfo };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', '获取网络信息失败', { detail: message, messageKey: 'error.getNetworkInfo' });
      return { success: false, error: message };
    }
  });

  // 切换网络适配器
  ipcMain.handle('network:select-adapter', async (_event, adapterName: string) => {
    try {
      const ip = getIPByAdapterName(adapterName);
      if (!ip) {
        return { success: false, error: '适配器不存在或无可用IP地址' };
      }
      
      // 存储用户选择的适配器名称
      setSelectedAdapterName(adapterName);
      
      return { success: true, data: { ip, adapterName } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', '切换网络适配器失败', { detail: message, messageKey: 'error.switchAdapter' });
      return { success: false, error: message };
    }
  });

  // ==================== 分享相关 ====================

  // 创建分享任务
  ipcMain.handle(IPC_CHANNELS.SHARE_CREATE, async (_event, params: CreateShareParams) => {
    try {
      const share = await shareManager.createShare(params);
      return { success: true, data: share };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', '创建分享失败', { detail: message, messageKey: 'error.createShare' });
      return { success: false, error: message };
    }
  });

  // 取消分享任务
  ipcMain.handle(IPC_CHANNELS.SHARE_CANCEL, async (_event, id: string) => {
    try {
      const result = await shareManager.cancelShare(id);
      return { success: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', `取消分享失败: ${id}`, { detail: message, messageKey: 'error.cancelShare', messageParams: [id] });
      return { success: false, error: message };
    }
  });

  // 取消所有分享任务
  ipcMain.handle(IPC_CHANNELS.SHARE_CANCEL_ALL, async () => {
    try {
      await shareManager.cancelAllShares();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', '取消所有分享失败', { detail: message, messageKey: 'error.cancelAllShares' });
      return { success: false, error: message };
    }
  });

  // 获取所有分享任务
  ipcMain.handle(IPC_CHANNELS.SHARE_GET_ALL, async () => {
    try {
      const shares = shareManager.getAllShares();
      return { success: true, data: shares };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', '获取分享列表失败', { detail: message, messageKey: 'error.getShareList' });
      return { success: false, error: message };
    }
  });

  // 更新分享配置
  ipcMain.handle(IPC_CHANNELS.SHARE_UPDATE_CONFIG, async (_event, id: string, config: Partial<ShareConfig>) => {
    try {
      const share = await shareManager.updateShareConfig(id, config);
      if (share) {
        return { success: true, data: share };
      }
      return { success: false, error: '分享任务不存在' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', `更新分享配置失败: ${id}`, { detail: message, messageKey: 'error.updateShareConfig', messageParams: [id] });
      return { success: false, error: message };
    }
  });

  // ==================== 文件相关 ====================

  // 选择文件
  ipcMain.handle(IPC_CHANNELS.FILE_SELECT, async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        title: '选择要分享的文件',
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }
      return { success: true, files: result.filePaths };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', '选择文件失败', { detail: message, messageKey: 'error.selectFile' });
      return { success: false, error: message };
    }
  });

  // 选择文件夹
  ipcMain.handle(IPC_CHANNELS.FILE_SELECT_FOLDER, async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: '选择要分享的文件夹',
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }
      return { success: true, folder: result.filePaths[0] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', '选择文件夹失败', { detail: message, messageKey: 'error.selectFolder' });
      return { success: false, error: message };
    }
  });

  // 从拖拽中获取文件路径
  ipcMain.handle(IPC_CHANNELS.FILE_PATH_FROM_DROP, async (_event, filePath: string) => {
    try {
      // 判断是否为文件夹
      const isFolder = fs.existsSync(filePath) && fs.lstatSync(filePath).isDirectory();
      return { success: true, path: filePath, isFolder };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', '获取拖拽文件路径失败', { detail: message, messageKey: 'error.getDropPath' });
      return { success: false, error: message };
    }
  });

  // ==================== 设置相关 ====================

  // 获取设置
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    try {
      const settings = await settingsManager.getSettings();
      return { success: true, data: settings };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', '获取设置失败', { detail: message, messageKey: 'error.getSettings' });
      return { success: false, error: message };
    }
  });

  // 保存设置
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, async (_event, settings: Partial<SystemSettings>) => {
    try {
      await settingsManager.saveSettings(settings);

      // 更新分享管理器的设置引用
      const fullSettings = await settingsManager.getSettings();
      shareManager.updateSettings(fullSettings);
      
      // 更新 httpServer 中的用户设置和限速设置
      httpServer.updateUserSettings({
        userName: fullSettings.userName,
        userAvatar: fullSettings.userAvatar
      });
      httpServer.updateSpeedLimit(fullSettings.downloadSpeedLimit || 0);
      
      // 通知渲染进程用户设置已更新
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.USER_SETTINGS_ON_UPDATE, {
          userName: fullSettings.userName,
          userAvatar: fullSettings.userAvatar
        });
      }

      logger.log('system', '设置已更新', { messageKey: 'settings.updated' });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', '保存设置失败', { detail: message, messageKey: 'error.saveSettings' });
      return { success: false, error: message };
    }
  });

  // 重置设置
  ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET, async () => {
    try {
      await settingsManager.resetSettings();

      // 更新分享管理器的设置引用
      const fullSettings = await settingsManager.getSettings();
      shareManager.updateSettings(fullSettings);

      logger.log('system', '设置已重置为默认值', { messageKey: 'settings.reset' });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', '重置设置失败', { detail: message, messageKey: 'error.resetSettings' });
      return { success: false, error: message };
    }
  });

  // ==================== 日志相关 ====================

  // 获取所有日志
  ipcMain.handle(IPC_CHANNELS.LOG_GET_ALL, async (_event, filter?: { type?: LogEntry['type']; startTime?: number; endTime?: number }) => {
    try {
      const logs = logger.getLogs(filter);
      return { success: true, data: logs };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // 清空日志
  ipcMain.handle(IPC_CHANNELS.LOG_CLEAR, async () => {
    try {
      logger.clearLogs();
      logger.log('system', '日志已清空', { messageKey: 'log.cleared' });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // 导出日志
  ipcMain.handle(IPC_CHANNELS.LOG_EXPORT, async (_event, language?: string) => {
    try {
      const exportPath = logger.exportLogs(language);
      // 在文件管理器中显示导出的文件
      await shell.showItemInFolder(exportPath);
      return { success: true, path: exportPath };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', '导出日志失败', { detail: message, messageKey: 'error.exportLogs' });
      return { success: false, error: message };
    }
  });

  // ==================== 热点相关 ====================

  // 启动热点
  ipcMain.handle(IPC_CHANNELS.HOTSPOT_START, async (_event, config?: { ssid: string; password: string }) => {
    try {
      const status = await hotspot.startHotspot(config);
      return { success: true, data: status };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // 停止热点
  ipcMain.handle(IPC_CHANNELS.HOTSPOT_STOP, async () => {
    try {
      const status = await hotspot.stopHotspot();
      return { success: true, data: status };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // 获取热点状态
  ipcMain.handle(IPC_CHANNELS.HOTSPOT_STATUS, async () => {
    try {
      const status = await hotspot.getHotspotStatus();
      return { success: true, data: status };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // 配置热点
  ipcMain.handle(IPC_CHANNELS.HOTSPOT_CONFIG, async (_event, config: { ssid: string; password: string }) => {
    try {
      await hotspot.configureHotspot(config);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', '配置热点失败', { detail: message, messageKey: 'error.configHotspot' });
      return { success: false, error: message };
    }
  });

  // ==================== 端口相关 ====================

  // 检查端口是否可用
  ipcMain.handle(IPC_CHANNELS.PORT_CHECK, async (_event, port: number) => {
    try {
      const available = await isPortAvailable(port);
      return { success: true, available };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // 查找可用端口
  ipcMain.handle(IPC_CHANNELS.PORT_FIND_AVAILABLE, async (_event, startPort?: number) => {
    try {
      const port = await findAvailablePort(startPort);
      return { success: true, port };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // ==================== 窗口控制 ====================

  // 最小化窗口
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, async () => {
    try {
      if (mainWindow) {
        mainWindow.minimize();
        return { success: true };
      }
      return { success: false, error: '窗口不存在' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // 最大化/还原窗口
  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, async () => {
    try {
      if (mainWindow) {
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        return { success: true };
      }
      return { success: false, error: '窗口不存在' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // 关闭窗口
  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, async () => {
    try {
      if (!mainWindow) {
        return { success: false, error: '窗口不存在' };
      }
      const settings = await settingsManager.getSettings();
      const behavior = settings.closeBehavior || 'ask';

      if (behavior === 'minimize') {
        mainWindow.hide();
        return { success: true, action: 'minimize' };
      }
      if (behavior === 'exit') {
        mainWindow.close();
        return { success: true, action: 'exit' };
      }
      return { success: true, action: 'ask' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // 关闭对话框确认
  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE_ACTION, async (_event, params: { action: 'minimize' | 'exit'; dontAskAgain: boolean }) => {
    try {
      if (!mainWindow) {
        return { success: false, error: '窗口不存在' };
      }
      if (params.dontAskAgain) {
        await settingsManager.saveSettings({ closeBehavior: params.action } as Partial<SystemSettings>);
      }
      if (params.action === 'minimize') {
        mainWindow.hide();
      } else {
        mainWindow.close();
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // 获取窗口是否最大化
  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, async () => {
    try {
      if (mainWindow) {
        return { success: true, isMaximized: mainWindow.isMaximized() };
      }
      return { success: false, error: '窗口不存在' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // ==================== 封禁IP管理 ====================

  ipcMain.handle(IPC_CHANNELS.BANNED_IPS_GET, async () => {
    try {
      const bannedIPs = httpServer.getBannedIPs();
      return { success: true, data: bannedIPs };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', '获取封禁IP列表失败', { detail: message, messageKey: 'error.getBannedIPs' });
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BANNED_IPS_UNBAN, async (_event, ip: string) => {
    try {
      const success = httpServer.unbanIP(ip);
      if (success) {
        logger.log('system', `解封IP: ${ip}`, { messageKey: 'bannedIP.unban', messageParams: [ip] });
        return { success: true };
      }
      return { success: false, error: 'IP未被封禁或不存在' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', '解封IP失败', { detail: message, messageKey: 'error.unbanIP' });
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BANNED_IPS_UPDATE_DURATION, async (_event, ip: string, durationMinutes: number) => {
    try {
      const success = httpServer.updateBanDuration(ip, durationMinutes);
      if (success) {
        logger.log('system', `更新封禁时长: ${ip} -> ${durationMinutes}分钟`, { messageKey: 'bannedIP.updateDuration', messageParams: [ip, String(durationMinutes)] });
        return { success: true };
      }
      return { success: false, error: 'IP未被封禁或不存在' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.log('error', '更新封禁时长失败', { detail: message, messageKey: 'error.updateBanDuration' });
      return { success: false, error: message };
    }
  });

  // ==================== 事件推送（主进程 -> 渲染进程） ====================

  // 注册分享更新事件推送
  shareManager.onShareUpdate((shares) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.SHARE_ON_UPDATE, shares);
    }
  });

  // 注册下载事件推送
  shareManager.onDownload((shareId, downloadCount) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.SHARE_ON_DOWNLOAD, { shareId, downloadCount });
    }
  });

  // 注册新日志推送
  const originalLog = logger.log.bind(logger);
  logger.log = (
    type: LogEntry['type'],
    message: string,
    opts?: { detail?: string; messageKey?: string; messageParams?: string[] }
  ) => {
    const entry = originalLog(type, message, opts);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.LOG_ON_NEW, entry);
    }
    return entry;
  };

  // 注册网络变化事件推送
  networkMonitor.start();

  // 应用版本
  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    return updater.getAppVersion();
  });

  ipcMain.handle(IPC_CHANNELS.APP_CHECK_UPDATE, async () => {
    return await updater.checkForUpdates();
  });

  // 注册窗口状态变化事件推送
  mainWindow.on('maximize', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.WINDOW_ON_STATE_CHANGE, { isMaximized: true });
    }
  });
  mainWindow.on('unmaximize', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.WINDOW_ON_STATE_CHANGE, { isMaximized: false });
    }
  });
}
