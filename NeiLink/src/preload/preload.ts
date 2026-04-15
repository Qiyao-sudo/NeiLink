/**
 * NeiLink Preload 脚本
 * 通过 contextBridge 安全地暴露 IPC 通道给渲染进程
 */

import { contextBridge, ipcRenderer } from 'electron';

// 直接定义 IPC_CHANNELS，避免路径加载问题
const IPC_CHANNELS = {
  NETWORK_GET_INFO: 'network:get-info',
  NETWORK_ON_CHANGE: 'network:on-change',
  SHARE_CREATE: 'share:create',
  SHARE_CANCEL: 'share:cancel',
  SHARE_CANCEL_ALL: 'share:cancel-all',
  SHARE_GET_ALL: 'share:get-all',
  SHARE_UPDATE_CONFIG: 'share:update-config',
  SHARE_ON_UPDATE: 'share:on-update',
  SHARE_ON_DOWNLOAD: 'share:on-download',
  FILE_SELECT: 'file:select',
  FILE_SELECT_FOLDER: 'file:select-folder',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_RESET: 'settings:reset',
  LOG_GET_ALL: 'log:get-all',
  LOG_CLEAR: 'log:clear',
  LOG_EXPORT: 'log:export',
  LOG_ON_NEW: 'log:on-new',
  HOTSPOT_START: 'hotspot:start',
  HOTSPOT_STOP: 'hotspot:stop',
  HOTSPOT_STATUS: 'hotspot:status',
  HOTSPOT_CONFIG: 'hotspot:config',
  PORT_CHECK: 'port:check',
  PORT_FIND_AVAILABLE: 'port:find-available',
  NOTIFICATION: 'notification',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
};

/**
 * 获取所有有效的 IPC 通道名称
 * 用于白名单验证
 */
const validChannels: string[] = Object.values(IPC_CHANNELS);

/**
 * 需要通过 invoke 调用的通道（请求-响应模式）
 */
const invokeChannels: string[] = [
  IPC_CHANNELS.NETWORK_GET_INFO,
  IPC_CHANNELS.SHARE_CREATE,
  IPC_CHANNELS.SHARE_CANCEL,
  IPC_CHANNELS.SHARE_CANCEL_ALL,
  IPC_CHANNELS.SHARE_GET_ALL,
  IPC_CHANNELS.SHARE_UPDATE_CONFIG,
  IPC_CHANNELS.FILE_SELECT,
  IPC_CHANNELS.FILE_SELECT_FOLDER,
  IPC_CHANNELS.SETTINGS_GET,
  IPC_CHANNELS.SETTINGS_SAVE,
  IPC_CHANNELS.SETTINGS_RESET,
  IPC_CHANNELS.LOG_GET_ALL,
  IPC_CHANNELS.LOG_CLEAR,
  IPC_CHANNELS.LOG_EXPORT,
  IPC_CHANNELS.HOTSPOT_START,
  IPC_CHANNELS.HOTSPOT_STOP,
  IPC_CHANNELS.HOTSPOT_STATUS,
  IPC_CHANNELS.PORT_CHECK,
  IPC_CHANNELS.PORT_FIND_AVAILABLE,
  IPC_CHANNELS.WINDOW_MINIMIZE,
  IPC_CHANNELS.WINDOW_MAXIMIZE,
  IPC_CHANNELS.WINDOW_CLOSE,
];

/**
 * 需要通过 on 监听的通道（主进程推送事件）
 */
const onChannels: string[] = [
  IPC_CHANNELS.NETWORK_ON_CHANGE,
  IPC_CHANNELS.SHARE_ON_UPDATE,
  IPC_CHANNELS.SHARE_ON_DOWNLOAD,
  IPC_CHANNELS.LOG_ON_NEW,
  IPC_CHANNELS.NOTIFICATION,
];

contextBridge.exposeInMainWorld('neilink', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  ipc: {
    /**
     * 发送消息到主进程（单向，无返回值）
     */
    send: (channel: string, ...args: unknown[]) => {
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      } else {
        console.warn(`[NeiLink] 未授权的 IPC send 通道: ${channel}`);
      }
    },

    /**
     * 监听主进程推送的事件
     */
    on: (channel: string, callback: (...args: unknown[]) => void) => {
      if (onChannels.includes(channel)) {
        // 使用 ipcRenderer.on 并在回调中解包事件参数
        const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
        ipcRenderer.on(channel, subscription);
        // 返回取消订阅函数
        return () => {
          ipcRenderer.removeListener(channel, subscription);
        };
      } else {
        console.warn(`[NeiLink] 未授权的 IPC on 通道: ${channel}`);
        return () => {};
      }
    },

    /**
     * 移除指定通道的所有监听器
     */
    removeAllListeners: (channel: string) => {
      if (validChannels.includes(channel)) {
        ipcRenderer.removeAllListeners(channel);
      }
    },

    /**
     * 调用主进程并等待返回结果（请求-响应模式）
     */
    invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
      if (invokeChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      } else {
        console.warn(`[NeiLink] 未授权的 IPC invoke 通道: ${channel}`);
        return Promise.reject(new Error(`未授权的 IPC 通道: ${channel}`));
      }
    },
  },
});
