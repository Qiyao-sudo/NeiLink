/**
 * NeiLink 共享类型定义
 * 主进程和渲染进程共用的类型和接口
 */

// 网络类型
export type NetworkType = 'wifi' | 'ethernet' | 'none';

// 网络适配器信息
export interface NetworkAdapter {
  name: string; // 适配器名称
  ip: string; // IPv4地址
  type: NetworkType; // 网络类型
  isOnline: boolean; // 是否在线
}

// 网络状态信息
export interface NetworkInfo {
  type: NetworkType;
  ip: string;
  ssid?: string;
  isOnline: boolean;
  adapters: NetworkAdapter[]; // 所有可用的网络适配器
  selectedAdapter?: string; // 当前选中的适配器名称
}

// 分享任务配置
export interface ShareConfig {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  isFolder: boolean;
  extractCode?: string;
  expiryTime?: number; // 过期时间戳
  maxDownloads: number; // -1表示不限
  maxConcurrent: number; // -1表示不限
  uploaderName: string;
  createdAt: number;
  port: number;
  status: 'active' | 'cancelled' | 'expired';
  downloadCount: number;
  encryptedFilePath?: string;
  encryptionKey?: string;
}

// 日志条目
export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'share' | 'download' | 'error' | 'system';
  message: string;
  detail?: string;
}

// 封禁IP信息
export interface BannedIPInfo {
  ip: string;
  attempts: number;
  windowStart: number;
  banExpiry: number;
  remainingTime: number;
}

// 系统设置
export interface SystemSettings {
  autoStart: boolean;
  defaultNickname: string; // 保留用于兼容性
  defaultExtractCode: boolean;
  defaultExpiry: string; // '1h', '6h', '24h', '7d', '30d', 'permanent'
  defaultMaxDownloads: number;
  defaultMaxConcurrent: number;
  port: number;
  hotspotPrefix: string;
  hotspotPasswordLength: number;
  encryptionBits: 128 | 256;
  rateLimitEnabled: boolean;
  rateLimitMaxAttempts: number;
  rateLimitBanDuration: number; // 分钟
  logRetentionDays: number;
  logStoragePath: string;
  clearSharesOnExit: boolean; // 应用关闭时删除已分享的文件
  selectedAdapter?: string; // 用户选择的网络适配器名称
  // 用户设置
  userName?: string; // 用户名称
  userAvatar?: string; // 用户头像的base64数据或文件路径
}

// IPC 通道定义
export const IPC_CHANNELS = {
  // 网络相关
  NETWORK_GET_INFO: 'network:get-info',
  NETWORK_ON_CHANGE: 'network:on-change',

  // 分享相关
  SHARE_CREATE: 'share:create',
  SHARE_CANCEL: 'share:cancel',
  SHARE_CANCEL_ALL: 'share:cancel-all',
  SHARE_GET_ALL: 'share:get-all',
  SHARE_UPDATE_CONFIG: 'share:update-config',
  SHARE_ON_UPDATE: 'share:on-update',
  SHARE_ON_DOWNLOAD: 'share:on-download',

  // 文件相关
  FILE_SELECT: 'file:select',
  FILE_SELECT_FOLDER: 'file:select-folder',
  FILE_PATH_FROM_DROP: 'file:path-from-drop',

  // 设置相关
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_RESET: 'settings:reset',

  // 日志相关
  LOG_GET_ALL: 'log:get-all',
  LOG_CLEAR: 'log:clear',
  LOG_EXPORT: 'log:export',
  LOG_ON_NEW: 'log:on-new',

  // 热点相关
  HOTSPOT_START: 'hotspot:start',
  HOTSPOT_STOP: 'hotspot:stop',
  HOTSPOT_STATUS: 'hotspot:status',
  HOTSPOT_CONFIG: 'hotspot:config',

  // 端口相关
  PORT_CHECK: 'port:check',
  PORT_FIND_AVAILABLE: 'port:find-available',

  // 通知
  NOTIFICATION: 'notification',

  // 窗口控制
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized',
  WINDOW_ON_STATE_CHANGE: 'window:on-state-change',
  
  // 封禁IP管理
  BANNED_IPS_GET: 'banned-ips:get',
  BANNED_IPS_UNBAN: 'banned-ips:unban',
  BANNED_IPS_UPDATE_DURATION: 'banned-ips:update-duration',
  
  // 用户设置相关
  USER_AVATAR_SET: 'user:avatar:set',
  USER_AVATAR_GET: 'user:avatar:get',
  USER_SETTINGS_ON_UPDATE: 'user:settings:on-update',
} as const;

// NeiLink API
export interface NeiLinkAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  getPathForFile: (file: File) => string;
  ipc: {
    send: (channel: string, ...args: unknown[]) => void;
    on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
    removeAllListeners: (channel: string) => void;
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  };
}

declare global {
  interface Window {
    neilink: NeiLinkAPI;
  }
}

export {};
