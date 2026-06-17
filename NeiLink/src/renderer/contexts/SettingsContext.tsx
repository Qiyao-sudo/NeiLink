import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { SystemSettings } from '../../shared/types';

/**
 * 渲染端默认设置（与主进程 DEFAULT_SETTINGS 保持一致）
 * 仅在主进程设置加载完成前作为占位，加载完成后会被真实设置覆盖。
 */
const DEFAULT_SETTINGS: SystemSettings = {
  autoStart: false,
  defaultNickname: 'NeiLink用户',
  defaultExtractCode: true,
  defaultExpiry: '24h',
  defaultMaxDownloads: -1,
  defaultMaxConcurrent: -1,
  port: 8080,
  hotspotSsid: 'NeiLink',
  hotspotPassword: '',
  hotspotRandomPassword: true,
  floatWindowEnabled: true,
  downloadSpeedLimit: 0,
  rateLimitEnabled: true,
  rateLimitMaxAttempts: 10,
  rateLimitBanDuration: 30,
  defaultEncrypt: false,
  logRetentionDays: 30,
  logStoragePath: '',
  clearSharesOnExit: false,
  closeBehavior: 'ask',
  language: 'zh-CN',
  theme: 'auto',
  userName: 'NeiLink用户',
  userAvatar: undefined,
  onboardingCompleted: false,
};

/** 自动保存的防抖延迟（毫秒），避免连续输入时频繁写入 */
const SAVE_DEBOUNCE_MS = 400;

interface SettingsContextType {
  settings: SystemSettings;
  loading: boolean;
  /** 更新单个设置项，乐观更新本地状态并防抖持久化 */
  updateSetting: <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => void;
  /** 批量更新设置项 */
  updateSettings: (partial: Partial<SystemSettings>) => void;
  /** 重置为默认设置 */
  resetSettings: () => Promise<void>;
  /** 重新从主进程拉取设置（强制刷新） */
  reload: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // 累积待保存的字段，防抖后一次性写入
  const pendingRef = useRef<Partial<SystemSettings>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const partial = pendingRef.current;
    pendingRef.current = {};
    if (Object.keys(partial).length === 0) return;
    try {
      await window.neilink.ipc.invoke('settings:save', partial);
    } catch (err) {
      console.error('自动保存设置失败:', err);
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void flush();
    }, SAVE_DEBOUNCE_MS);
  }, [flush]);

  const updateSettings = useCallback((partial: Partial<SystemSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
    pendingRef.current = { ...pendingRef.current, ...partial };
    scheduleSave();
  }, [scheduleSave]);

  const updateSetting = useCallback(
    <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
      updateSettings({ [key]: value } as Partial<SystemSettings>);
    },
    [updateSettings]
  );

  const reload = useCallback(async () => {
    try {
      const result = (await window.neilink.ipc.invoke('settings:get')) as any;
      if (result?.success && result.data && typeof result.data === 'object') {
        setSettings({ ...DEFAULT_SETTINGS, ...result.data });
      }
    } catch (err) {
      console.error('加载设置失败:', err);
    }
  }, []);

  const resetSettings = useCallback(async () => {
    try {
      await window.neilink.ipc.invoke('settings:reset');
      pendingRef.current = {};
      await reload();
    } catch (err) {
      console.error('重置设置失败:', err);
    }
  }, [reload]);

  // 启动时加载一次设置
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await reload();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
      // 应用关闭前确保挂起的更改落盘
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SettingsContext.Provider
      value={{ settings, loading, updateSetting, updateSettings, resetSettings, reload }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
