/**
 * 热点管理模块（预留接口）
 * 当前为预留实现，后续可根据平台扩展
 */

/**
 * 热点配置接口
 */
export interface HotspotConfig {
  ssid: string;
  password: string;
}

/**
 * 热点状态
 */
export interface HotspotStatus {
  enabled: boolean;
  ssid?: string;
  error?: string;
}

/**
 * 启动热点
 * @param config 热点配置（可选）
 */
export async function startHotspot(config?: HotspotConfig): Promise<HotspotStatus> {
  // 预留接口 - 功能开发中
  console.log('[Hotspot] 启动热点请求:', config);
  return {
    enabled: false,
    error: '热点功能正在开发中，敬请期待',
  };
}

/**
 * 停止热点
 */
export async function stopHotspot(): Promise<HotspotStatus> {
  // 预留接口
  console.log('[Hotspot] 停止热点请求');
  return {
    enabled: false,
    error: '热点功能正在开发中，敬请期待',
  };
}

/**
 * 获取热点状态
 */
export async function getHotspotStatus(): Promise<HotspotStatus> {
  return {
    enabled: false,
    error: '热点功能正在开发中，敬请期待',
  };
}

/**
 * 配置热点
 * @param config 热点配置
 */
export async function configureHotspot(config: HotspotConfig): Promise<void> {
  // 预留接口 - 功能开发中
  console.log('[Hotspot] 配置热点请求:', config);
}

/**
 * 检查热点功能是否可用
 * 当前始终返回 false
 */
export async function isHotspotAvailable(): Promise<boolean> {
  return false;
}
