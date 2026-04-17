/**
 * 系统设置管理模块
 * 管理应用的持久化配置
 */

import * as fs from 'fs';
import * as path from 'path';
import { SystemSettings } from '../../shared/types';
import { updateRateLimitSettings } from './httpServer';

/** 默认系统设置 */
const DEFAULT_SETTINGS: SystemSettings = {
  autoStart: false,
  defaultNickname: 'NeiLink用户',
  defaultExtractCode: true,
  defaultExpiry: 24, // 默认24小时过期
  defaultMaxDownloads: -1, // 不限
  defaultMaxConcurrent: -1, // 不限
  port: 8080,
  hotspotPrefix: 'NeiLink',
  hotspotPasswordLength: 8,
  encryptionBits: 256,
  rateLimitEnabled: true,
  rateLimitMaxAttempts: 10,
  rateLimitBanDuration: 30, // 30分钟
  logRetentionDays: 30,
  logStoragePath: '', // 运行时由 app.getPath('userData') 填充
};

export class SettingsManager {
  private settingsFilePath: string;
  private settings: SystemSettings;
  private initialized: boolean = false;
  private userDataPath: string;

  /**
   * @param userDataPath 应用数据目录路径
   */
  constructor(userDataPath: string) {
    this.userDataPath = userDataPath;
    this.settingsFilePath = path.join(userDataPath, 'settings.json');

    // 深拷贝默认设置
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

    // 设置日志存储路径
    this.settings.logStoragePath = path.join(userDataPath, 'logs');
  }

  /**
   * 初始化设置（从文件加载或使用默认值）
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      if (fs.existsSync(this.settingsFilePath)) {
        const content = fs.readFileSync(this.settingsFilePath, 'utf-8');
        const savedSettings = JSON.parse(content) as Partial<SystemSettings>;

        // 合并保存的设置到默认设置中
        this.settings = { ...this.settings, ...savedSettings };
        
        // 确保日志存储路径不为空
        if (!this.settings.logStoragePath || this.settings.logStoragePath.trim() === '') {
          this.settings.logStoragePath = path.join(this.userDataPath, 'logs');
        }
      } else {
        // 首次运行，保存默认设置
        await this.saveSettings(this.settings);
      }

      // 初始化时更新 httpServer 的限流设置
      updateRateLimitSettings({
        rateLimitEnabled: this.settings.rateLimitEnabled,
        rateLimitMaxAttempts: this.settings.rateLimitMaxAttempts,
        rateLimitBanDuration: this.settings.rateLimitBanDuration,
      });
    } catch (err) {
      console.error('加载设置失败，使用默认设置:', err);
      await this.saveSettings(this.settings);
    }

    this.initialized = true;
  }

  /**
   * 获取当前设置
   */
  async getSettings(): Promise<SystemSettings> {
    if (!this.initialized) {
      await this.initialize();
    }
    return { ...this.settings };
  }

  /**
   * 保存设置（部分更新）
   * @param settings 要更新的设置项
   */
  async saveSettings(settings: Partial<SystemSettings>): Promise<void> {
    try {
      // 合并设置
      this.settings = { ...this.settings, ...settings };

      // 更新 httpServer 的限流设置
      updateRateLimitSettings({
        rateLimitEnabled: this.settings.rateLimitEnabled,
        rateLimitMaxAttempts: this.settings.rateLimitMaxAttempts,
        rateLimitBanDuration: this.settings.rateLimitBanDuration,
      });

      // 确保目录存在
      const dir = path.dirname(this.settingsFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 写入文件
      fs.writeFileSync(
        this.settingsFilePath,
        JSON.stringify(this.settings, null, 2),
        'utf-8'
      );
    } catch (err) {
      throw new Error(`保存设置失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * 重置为默认设置
   */
  async resetSettings(): Promise<void> {
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    await this.saveSettings(this.settings);
  }

  /**
   * 获取默认设置（不修改当前设置）
   */
  getDefaultSettings(): SystemSettings {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
}
