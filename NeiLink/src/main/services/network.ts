/**
 * 网络检测模块
 * 获取网络接口信息、IP地址、可用端口等
 */

import * as os from 'os';
import * as net from 'net';
import { NetworkInfo, NetworkType, NetworkAdapter } from '../../shared/types';

// 存储用户选择的网络适配器名称
let selectedAdapterName: string | undefined = undefined;

/**
 * 设置选中的网络适配器名称
 */
export function setSelectedAdapterName(adapterName: string | undefined): void {
  selectedAdapterName = adapterName;
}

/**
 * 获取局域网IP地址（优先返回IPv4非回环地址）
 */
export function getLocalIP(): string {
  // 如果用户已选择适配器，优先使用该适配器的IP地址
  if (selectedAdapterName) {
    const ip = getIPByAdapterName(selectedAdapterName);
    if (ip) {
      return ip;
    }
  }

  const interfaces = os.networkInterfaces();
  const candidates: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name] || [];
    for (const netInfo of nets) {
      // 跳过回环地址和非IPv4地址
      if (netInfo.family === 'IPv4' && !netInfo.internal) {
        // 优先选择以太网接口（通常以 en 或 eth 开头）
        if (name.startsWith('en') || name.startsWith('eth')) {
          return netInfo.address;
        }
        candidates.push(netInfo.address);
      }
    }
  }

  // 如果没有以太网接口，返回第一个可用的IPv4地址
  return candidates[0] || '127.0.0.1';
}

/**
 * 推断网络类型
 */
function detectNetworkType(): NetworkType {
  // 如果用户已选择适配器，优先使用该适配器检测网络类型
  if (selectedAdapterName) {
    return detectAdapterType(selectedAdapterName);
  }

  // 获取当前的IP地址
  const currentIP = getLocalIP();
  
  // 先查找与当前IP地址匹配的接口
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name] || [];
    for (const netInfo of nets) {
      if (netInfo.family === 'IPv4' && !netInfo.internal && netInfo.address === currentIP) {
        return detectAdapterType(name);
      }
    }
  }
  
  // 如果没有找到与当前IP地址匹配的接口，再按默认顺序查找
  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name] || [];
    for (const netInfo of nets) {
      if (netInfo.family === 'IPv4' && !netInfo.internal) {
        // 优先检查以太网接口
        if (name.startsWith('en') || name.startsWith('eth')) {
          return 'ethernet';
        }
        // Wi-Fi 接口通常以 wlan、Wi-Fi 开头
        if (name.toLowerCase().startsWith('wlan') || name.toLowerCase().includes('wi-fi')) {
          return 'wifi';
        }
      }
    }
  }
  return 'none';
}

/**
 * 推断单个适配器的网络类型
 */
function detectAdapterType(adapterName: string): NetworkType {
  const lowerName = adapterName.toLowerCase();
  if (lowerName.startsWith('wlan') || lowerName.includes('wi-fi')) {
    return 'wifi';
  }
  // 其他所有适配器都默认为以太网
  return 'ethernet';
}

/**
 * 获取所有网络适配器信息
 */
export function getAllAdapters(): NetworkAdapter[] {
  const interfaces = os.networkInterfaces();
  const adapters: NetworkAdapter[] = [];

  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name] || [];
    for (const netInfo of nets) {
      // 只处理IPv4非回环地址
      if (netInfo.family === 'IPv4' && !netInfo.internal) {
        adapters.push({
          name,
          ip: netInfo.address,
          type: detectAdapterType(name),
          isOnline: true
        });
      }
    }
  }

  return adapters;
}

/**
 * 根据适配器名称获取IP地址
 */
export function getIPByAdapterName(adapterName: string): string | null {
  const interfaces = os.networkInterfaces();
  const nets = interfaces[adapterName] || [];
  
  for (const netInfo of nets) {
    if (netInfo.family === 'IPv4' && !netInfo.internal) {
      return netInfo.address;
    }
  }
  
  return null;
}

/**
 * 获取完整的网络状态信息
 */
export function getNetworkInfo(): NetworkInfo {
  const ip = getLocalIP();
  const type = detectNetworkType();
  const adapters = getAllAdapters();
  
  // 网络状态判断：如果有有效的IP地址且不是回环地址，则认为网络是连接的
  const isOnline = ip !== '127.0.0.1' && adapters.length > 0;
  
  // 使用用户选择的适配器名称，如果没有选择则根据IP地址查找
  let currentSelectedAdapter = selectedAdapterName;
  if (!currentSelectedAdapter) {
    for (const adapter of adapters) {
      if (adapter.ip === ip) {
        currentSelectedAdapter = adapter.name;
        break;
      }
    }
  }

  return {
    type,
    ip,
    isOnline,
    // SSID 在桌面端难以直接获取，留空由上层处理
    ssid: undefined,
    adapters,
    selectedAdapter: currentSelectedAdapter
  };
}

/**
 * 检查指定端口是否可用
 */
export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });

    // 监听所有网络接口
    server.listen(port, '0.0.0.0');
  });
}

/**
 * 从指定端口开始查找可用端口
 * @param startPort 起始端口号，默认 8080
 * @param maxRange 最大搜索范围，默认 100
 */
export async function findAvailablePort(startPort: number = 8080, maxRange: number = 100): Promise<number> {
  for (let port = startPort; port < startPort + maxRange; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`在 ${startPort}-${startPort + maxRange - 1} 范围内未找到可用端口`);
}

/**
 * 获取本机计算机名
 */
export function getHostname(): string {
  return os.hostname();
}

/**
 * 网络变化监控器
 * 使用轮询方式检测网络状态变化
 */
export class NetworkMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private lastNetworkInfo: NetworkInfo | null = null;
  private callback: (info: NetworkInfo) => void;
  private pollInterval: number;

  /**
   * @param callback 网络变化时的回调函数
   * @param pollInterval 轮询间隔（毫秒），默认 5000
   */
  constructor(callback: (info: NetworkInfo) => void, pollInterval: number = 5000) {
    this.callback = callback;
    this.pollInterval = pollInterval;
  }

  /**
   * 启动网络监控
   */
  start(): void {
    if (this.intervalId) {
      return; // 已经在监控中
    }

    // 立即获取一次当前网络状态
    this.lastNetworkInfo = getNetworkInfo();

    // 定时轮询
    this.intervalId = setInterval(() => {
      const currentInfo = getNetworkInfo();

      // 检测网络状态是否发生变化
      if (
        !this.lastNetworkInfo ||
        currentInfo.ip !== this.lastNetworkInfo.ip ||
        currentInfo.type !== this.lastNetworkInfo.type ||
        currentInfo.isOnline !== this.lastNetworkInfo.isOnline
      ) {
        this.lastNetworkInfo = currentInfo;
        this.callback(currentInfo);
      }
    }, this.pollInterval);
  }

  /**
   * 停止网络监控
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * 获取当前网络状态
   */
  getCurrentInfo(): NetworkInfo {
    return this.lastNetworkInfo || getNetworkInfo();
  }
}
