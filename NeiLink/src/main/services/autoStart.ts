/**
 * 开机自启管理模块
 * 封装 Electron 的登录项设置，将“开机自启”开关与操作系统实际状态打通。
 *
 * - Windows：打包后写入注册表 HKCU\...\Run，开发环境下写入“启动”文件夹快捷方式。
 * - macOS：写入 Login Items（配合 AutoLaunchedApplicationDictionary）。
 * - 自启入口会附带 --hidden 参数，使应用在开机启动时静默驻留托盘，不打扰用户。
 */

import { app } from 'electron';

/** 自启时附加的启动参数，用于让主窗口启动后隐藏到托盘 */
export const AUTO_START_HIDDEN_ARG = '--hidden';

/**
 * 判断当前是否由开机自启（带 --hidden 参数）启动。
 * 用于在启动流程中决定是否隐藏主窗口。
 */
export function isLaunchedHidden(): boolean {
  return process.argv.includes(AUTO_START_HIDDEN_ARG);
}

/**
 * 设置开机自启状态
 * @param enabled 是否启用开机自启
 * @returns 是否设置成功
 */
export function setAutoStart(enabled: boolean): boolean {
  try {
    app.setLoginItemSettings({
      openAtLogin: !!enabled,
      openAsHidden: process.platform === 'darwin' ? !!enabled : false,
      args: [AUTO_START_HIDDEN_ARG],
    });
    return true;
  } catch (err) {
    console.error('设置开机自启失败:', err);
    return false;
  }
}

/**
 * 查询操作系统当前的开机自启实际状态。
 * 注意：getLoginItemSettings 会校验 args，因此必须与 setAutoStart 使用相同的参数。
 * @returns 是否已启用
 */
export function isAutoStartEnabled(): boolean {
  try {
    return app.getLoginItemSettings().openAtLogin;
  } catch (err) {
    console.error('查询开机自启状态失败:', err);
    return false;
  }
}
