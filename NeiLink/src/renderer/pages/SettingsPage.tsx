import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  Switch,
  Input,
  Select,
  InputNumber,
  Button,
  Space,
  Typography,
  App,
  Divider,
  Table,
  Popconfirm,
  Tag,
  Avatar,
} from 'antd';
import {
  SaveOutlined,
  UndoOutlined,
  FolderOpenOutlined,
  SearchOutlined,
  ReloadOutlined,
  UnlockOutlined,
  ClockCircleOutlined,
  UserOutlined,
  PlusOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import { NetworkInfo, BannedIPInfo } from '../../shared/types';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { getSupportedLanguages } from '../../shared/i18n';

const { Text, Title } = Typography;

interface AppSettings {
  // 用户设置
  userName?: string;
  userAvatar?: string;

  // 基础设置
  autoStart: boolean;
  defaultNickname: string;
  defaultExtractCode: boolean;
  defaultExpiry: string;
  defaultMaxDownloads: number;
  defaultMaxConcurrent: number;
  clearSharesOnExit: boolean;
  closeBehavior: 'ask' | 'minimize' | 'exit';
  language: string;
  theme: 'light' | 'dark' | 'auto';

  // 网络设置
  port: number;
  downloadSpeedLimit: number;
  hotspotPrefix: string;
  hotspotPasswordLength: number;

  // 安全设置
  rateLimitEnabled: boolean;
  rateLimitMaxAttempts: number;
  rateLimitBanDuration: number;

  // 日志设置
  logRetentionDays: number;
  logStoragePath: string;
}

const defaultSettings: AppSettings = {
  userName: 'NeiLink用户',
  userAvatar: undefined,
  autoStart: false,
  defaultNickname: '',
  defaultExtractCode: true,
  defaultExpiry: '24h',
  defaultMaxDownloads: -1,
  defaultMaxConcurrent: -1,
  clearSharesOnExit: false,
  closeBehavior: 'ask',
  language: 'zh-CN',
  theme: 'auto',
  port: 8080,
  downloadSpeedLimit: 0,
  hotspotPrefix: 'NeiLink',
  hotspotPasswordLength: 8,
  rateLimitEnabled: true,
  rateLimitMaxAttempts: 10,
  rateLimitBanDuration: 30,
  logRetentionDays: 30,
  logStoragePath: '',
};

const SettingsPage: React.FC = () => {
  const { message } = App.useApp();
  const { locale, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    type: 'none',
    ip: '0.0.0.0',
    isOnline: false,
    adapters: [],
    selectedAdapter: undefined,
  });
  const [bannedIPs, setBannedIPs] = useState<BannedIPInfo[]>([]);
  const [bannedIPsLoading, setBannedIPsLoading] = useState(false);
  const [refreshTimer, setRefreshTimer] = useState<any>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const initialSettingsRef = useRef<AppSettings>(defaultSettings);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.neilink.ipc.invoke('settings:get') as any;
      if (result?.success && result.data && typeof result.data === 'object') {
        let convertedData = { ...result.data };
        // 兼容旧版本，将数值类型的 defaultExpiry 转换为字符串
        if (typeof convertedData.defaultExpiry === 'number') {
          const numVal = convertedData.defaultExpiry as number;
          if (numVal === -1) {
            convertedData.defaultExpiry = 'permanent';
          } else if (numVal <= 1) {
            convertedData.defaultExpiry = '1h';
          } else if (numVal <= 6) {
            convertedData.defaultExpiry = '6h';
          } else if (numVal <= 24) {
            convertedData.defaultExpiry = '24h';
          } else if (numVal <= 168) {
            convertedData.defaultExpiry = '7d';
          } else {
            convertedData.defaultExpiry = '30d';
          }
        }
        const finalSettings = { ...defaultSettings, ...convertedData };
        setSettings(finalSettings);
        initialSettingsRef.current = { ...finalSettings };
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error('获取设置失败:', error);
      message.error('获取设置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNetworkInfo = useCallback(async () => {
    try {
      const result = await window.neilink.ipc.invoke('network:get-info') as any;
      if (result?.success && result.data) {
        setNetworkInfo(result.data as NetworkInfo);
      }
    } catch {
      // 忽略网络信息获取失败的情况
    }
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => {
      const newSettings = { ...prev, [key]: value };
      // 检查是否有更改
      const hasChanges = JSON.stringify(newSettings) !== JSON.stringify(initialSettingsRef.current);
      setHasUnsavedChanges(hasChanges);
      return newSettings;
    });
  };

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      const result = await window.neilink.ipc.invoke('settings:save', settings) as any;
      if (result?.success) {
        message.success('配置已保存');
        // 保存成功后更新初始设置引用
        initialSettingsRef.current = { ...settings };
        setHasUnsavedChanges(false);
      } else {
        message.error(result?.error || '保存配置失败');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      message.error('保存配置失败');
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const handleReset = async () => {
    try {
      await window.neilink.ipc.invoke('settings:reset');
      setSettings(defaultSettings);
      initialSettingsRef.current = { ...defaultSettings };
      setHasUnsavedChanges(false);
      message.success('已恢复默认设置');
    } catch {
      message.error('恢复默认设置失败');
    }
  };

  const handleSelectAvatar = async () => {
    try {
      // 直接使用 input 元素选择文件，避免两次弹窗问题
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            updateSetting('userAvatar', base64);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } catch {
      message.error('选择头像失败');
    }
  };

  const handleAvatarClick = (e: React.MouseEvent) => {
    if (settings.userAvatar) {
      // 如果有头像，点击右下角图标时移除，否则选择新头像
      // 我们需要判断点击的是头像本身还是右下角图标
      // 这里我们简化处理：直接通过判断是否有头像来决定功能
      // 实际上，我们将右下角图标单独处理
      handleSelectAvatar();
    } else {
      // 如果没有头像，点击选择新头像
      handleSelectAvatar();
    }
  };

  const handleRemoveAvatar = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡
    updateSetting('userAvatar', undefined);
  };

  const handleDetectPort = async () => {
    try {
      const result = await window.neilink.ipc.invoke('port:find-available', settings.port) as any;
      if (result?.success && result.port) {
        updateSetting('port', result.port);
        message.success(`检测到可用端口: ${result.port}`);
      }
    } catch {
      message.error('端口检测失败');
    }
  };

  const handleChangeLogPath = async () => {
    try {
      const result = await window.neilink.ipc.invoke('file:select-folder') as any;
      if (result?.success && result.folder) {
        updateSetting('logStoragePath', result.folder);
      }
    } catch {
      message.error('选择路径失败');
    }
  };

  const handleAdapterChange = async (adapterName: string) => {
    try {
      const result = await window.neilink.ipc.invoke('network:select-adapter', adapterName) as any;
      if (result?.success) {
        message.success('网络适配器已切换');
        // 重新获取网络信息
        await fetchNetworkInfo();
      } else {
        message.error(result?.error || '切换适配器失败');
      }
    } catch {
      message.error('切换适配器失败');
    }
  };

  const fetchBannedIPs = useCallback(async () => {
    try {
      setBannedIPsLoading(true);
      const result = await window.neilink.ipc.invoke('banned-ips:get') as any;
      if (result?.success && Array.isArray(result.data)) {
        setBannedIPs(result.data);
      }
    } catch {
      // 静默失败，不显示错误
    } finally {
      setBannedIPsLoading(false);
    }
  }, []);

  const handleUnbanIP = async (ip: string) => {
    try {
      const result = await window.neilink.ipc.invoke('banned-ips:unban', ip) as any;
      if (result?.success) {
        message.success(`已解封 IP: ${ip}`);
        await fetchBannedIPs();
      } else {
        message.error(result?.error || '解封失败');
      }
    } catch {
      message.error('解封失败');
    }
  };

  const handleUpdateBanDuration = async (ip: string, durationMinutes: number) => {
    try {
      const result = await window.neilink.ipc.invoke('banned-ips:update-duration', ip, durationMinutes) as any;
      if (result?.success) {
        message.success(`已更新封禁时长为 ${durationMinutes} 分钟`);
        await fetchBannedIPs();
      } else {
        message.error(result?.error || '更新封禁时长失败');
      }
    } catch {
      message.error('更新封禁时长失败');
    }
  };

  const formatRemainingTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} 秒`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)} 分钟`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchNetworkInfo();
    fetchBannedIPs();

    const timer = setInterval(() => {
      fetchBannedIPs();
    }, 5000);
    setRefreshTimer(timer);

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [fetchSettings, fetchNetworkInfo, fetchBannedIPs]);

  // 离开页面时自动保存
  useEffect(() => {
    return () => {
      if (hasUnsavedChanges) {
        // 使用同步方式保存，因为组件即将卸载
        (async () => {
          try {
            await window.neilink.ipc.invoke('settings:save', settings);
            console.log('设置已自动保存');
          } catch (error) {
            console.error('自动保存设置失败:', error);
          }
        })();
      }
    };
  }, [hasUnsavedChanges, settings]);

  return (
    <div>
      {/* 用户设置 */}
      <div className="settings-section">
        <div className="settings-section-title">{locale.settings.user}</div>

        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.userAvatar}</div>
            <div className="settings-desc">{locale.settings.userAvatarHint}</div>
          </div>
          <Space align="center">
            <div style={{ cursor: 'pointer', position: 'relative' }} onClick={handleSelectAvatar}>
              <Avatar
                size={60}
                src={settings.userAvatar}
                icon={<UserOutlined />}
                style={{ backgroundColor: '#1890ff' }}
              />
              {settings.userAvatar && (
                <div 
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    backgroundColor: '#ff4d4f',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    cursor: 'pointer',
                  }}
                  onClick={handleRemoveAvatar}
                >
                  <MinusOutlined />
                </div>
              )}
            </div>
          </Space>
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.userName}</div>
            <div className="settings-desc">{locale.settings.userNameHint}</div>
          </div>
          <Input
            value={settings.userName || ''}
            onChange={(e) => updateSetting('userName', e.target.value)}
            placeholder="{locale.settings.userNameHint}"
            maxLength={20}
            style={{ width: 200 }}
          />
        </div>
      </div>

      {/* 基础设置 */}
      <div className="settings-section">
        <div className="settings-section-title">{locale.settings.general}</div>


        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.autoStart}</div>
            <div className="settings-desc">{locale.settings.autoStartHint}</div>
          </div>
          <Switch
            checked={settings.autoStart}
            onChange={(val) => updateSetting('autoStart', val)}
          />
        </div>

        
        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.language}</div>
            <div className="settings-desc">{locale.settings.languageHint}</div>
          </div>
          <Select
            value={settings.language}
            onChange={(val) => {
              updateSetting('language', val);
              setLanguage(val);
            }}
            style={{ width: 140 }}
            options={getSupportedLanguages()}
          />
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.theme}</div>
            <div className="settings-desc">{locale.settings.themeHint}</div>
          </div>
          <Select
            value={settings.theme}
            onChange={(val) => {
              updateSetting('theme', val);
              setTheme(val);
            }}
            style={{ width: 140 }}
            options={[
              { value: 'light', label: locale.settings.themeLight },
              { value: 'dark', label: locale.settings.themeDark },
              { value: 'auto', label: locale.settings.themeAuto },
            ]}
          />
        </div>


        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.defaultExtractCode}</div>
            <div className="settings-desc">{locale.settings.defaultExtractCodeHint}</div>
          </div>
          <Switch
            checked={settings.defaultExtractCode}
            onChange={(val) => updateSetting('defaultExtractCode', val)}
          />
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.defaultExpiry}</div>
            <div className="settings-desc">{locale.settings.defaultExpiryHint}</div>
          </div>
          <Select
            value={settings.defaultExpiry}
            onChange={(val) => updateSetting('defaultExpiry', val)}
            style={{ width: 140 }}
            options={[
              { value: '1h', label: `1 ${locale.settings.hour}` },
              { value: '6h', label: `6 ${locale.settings.hour}` },
              { value: '24h', label: `24 ${locale.settings.hour}` },
              { value: '7d', label: `7 ${locale.settings.day}` },
              { value: '30d', label: `30 ${locale.settings.day}` },
              { value: 'permanent', label: locale.settings.permanent },
            ]}
          />
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.defaultMaxDownloads}</div>
            <div className="settings-desc">{locale.settings.defaultMaxDownloadsHint}</div>
          </div>
          <Select
            value={settings.defaultMaxDownloads}
            onChange={(val) => updateSetting('defaultMaxDownloads', val)}
            style={{ width: 140 }}
            options={[
              { value: 1, label: `1 ${locale.settings.time}` },
              { value: 5, label: `5 ${locale.settings.time}` },
              { value: 10, label: `10 ${locale.settings.time}` },
              { value: 50, label: `50 ${locale.settings.time}` },
              { value: -1, label: locale.settings.unlimited },
            ]}
          />
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.defaultMaxConcurrent}</div>
            <div className="settings-desc">{locale.settings.defaultMaxConcurrentHint}</div>
          </div>
          <Select
            value={settings.defaultMaxConcurrent}
            onChange={(val) => updateSetting('defaultMaxConcurrent', val)}
            style={{ width: 140 }}
            options={[
              { value: 3, label: `3 ${locale.settings.count}` },
              { value: 5, label: `5 ${locale.settings.count}` },
              { value: 10, label: `10 ${locale.settings.count}` },
              { value: -1, label: locale.settings.unlimited },
            ]}
          />
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.clearSharesOnExit}</div>
            <div className="settings-desc">{locale.settings.clearSharesOnExitHint}</div>
          </div>
          <Switch
            checked={settings.clearSharesOnExit}
            onChange={(val) => updateSetting('clearSharesOnExit', val)}
          />
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.closeBehavior}</div>
            <div className="settings-desc">{locale.settings.closeBehaviorHint}</div>
          </div>
          <Select
            value={settings.closeBehavior}
            onChange={(val) => updateSetting('closeBehavior', val)}
            style={{ width: 200 }}
            options={[
              { value: 'ask', label: locale.settings.closeBehaviorAsk },
              { value: 'minimize', label: locale.settings.closeBehaviorMinimize },
              { value: 'exit', label: locale.settings.closeBehaviorExit },
            ]}
          />
        </div>


      </div>

      {/* 网络设置 */}
      <div className="settings-section">
        <div className="settings-section-title">{locale.settings.network}</div>
        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.selectedAdapter}</div>
            <div className="settings-desc">{locale.settings.selectedAdapterHint}</div>
          </div>
          <Select
            value={networkInfo.selectedAdapter}
            onChange={handleAdapterChange}
            style={{ width: 300 }}
            options={networkInfo.adapters.map(adapter => ({
              label: `${adapter.name} (${adapter.ip})`,
              value: adapter.name,
            }))}
            placeholder={locale.settings.selectedAdapterHint}
            disabled={networkInfo.adapters.length <= 1}
          />
        </div>
        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.port}</div>
            <div className="settings-desc">{locale.settings.portHint} (1-65535)</div>
          </div>
          <Space>
            <InputNumber
              value={settings.port}
              onChange={(val) => val && updateSetting('port', val)}
              min={1}
              max={65535}
              style={{ width: 120 }}
            />
            <Button
              icon={<SearchOutlined />}
              onClick={handleDetectPort}
              size="small"
            >
              {locale.settings.detectPort}
            </Button>
          </Space>
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.downloadSpeedLimit}</div>
            <div className="settings-desc">{locale.settings.downloadSpeedLimitHint}</div>
          </div>
          <Select
            value={settings.downloadSpeedLimit}
            onChange={(val) => updateSetting('downloadSpeedLimit', val)}
            style={{ width: 140 }}
            options={[
              { value: 0, label: locale.settings.downloadSpeedLimitUnlimited },
              { value: 1024, label: '1 MB/s' },
              { value: 5120, label: '5 MB/s' },
              { value: 10240, label: '10 MB/s' },
              { value: 51200, label: '50 MB/s' },
              { value: 102400, label: '100 MB/s' },
            ]}
          />
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.hotspotPrefix}</div>
            <div className="settings-desc">{locale.settings.hotspotPrefixHint}</div>
          </div>
          <Input
            value={settings.hotspotPrefix}
            onChange={(e) => updateSetting('hotspotPrefix', e.target.value)}
            placeholder="NeiLink"
            maxLength={20}
            style={{ width: 200 }}
          />
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.hotspotPasswordLength}</div>
            <div className="settings-desc">{locale.settings.hotspotPasswordLengthHint} (8-63)</div>
          </div>
          <InputNumber
            value={settings.hotspotPasswordLength}
            onChange={(val) => val && updateSetting('hotspotPasswordLength', val)}
            min={8}
            max={63}
            style={{ width: 120 }}
          />
        </div>
      </div>

      {/* 安全设置 */}
      <div className="settings-section">
        <div className="settings-section-title">{locale.settings.security}</div>

        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.rateLimitEnabled}</div>
            <div className="settings-desc">{locale.settings.rateLimitEnabledHint}</div>
          </div>
          <Switch
            checked={settings.rateLimitEnabled}
            onChange={(val) => updateSetting('rateLimitEnabled', val)}
          />
        </div>

        {settings.rateLimitEnabled && (
          <>
            <div className="settings-item">
              <div>
                <div className="settings-label">{locale.settings.rateLimitMaxAttempts}</div>
                <div className="settings-desc">{locale.settings.rateLimitMaxAttemptsHint}</div>
              </div>
              <InputNumber
                value={settings.rateLimitMaxAttempts}
                onChange={(val) => val && updateSetting('rateLimitMaxAttempts', val)}
                min={1}
                max={100}
                style={{ width: 120 }}
              />
            </div>

            <div className="settings-item">
              <div>
                <div className="settings-label">{locale.settings.rateLimitBanDuration}</div>
                <div className="settings-desc">{locale.settings.rateLimitBanDurationHint}</div>
              </div>
              <InputNumber
                value={settings.rateLimitBanDuration}
                onChange={(val) => val && updateSetting('rateLimitBanDuration', val)}
                min={1}
                max={1440}
                style={{ width: 120 }}
              />
            </div>
          </>
        )}
      </div>

      {/* 封禁IP管理 */}
      <div className="settings-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="settings-section-title">{locale.settings.bannedIPManagement}</div>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchBannedIPs}
            loading={bannedIPsLoading}
            size="small"
          >
            {locale.common.refresh}
          </Button>
        </div>

        <Table
          dataSource={bannedIPs}
          loading={bannedIPsLoading}
          rowKey="ip"
          pagination={false}
          size="small"
          locale={{ emptyText: locale.settings.noBannedIPs }}
          columns={[
            {
              title: locale.settings.ipAddress,
              dataIndex: 'ip',
              key: 'ip',
              width: 180,
              render: (ip) => <Text strong>{ip}</Text>,
            },
            {
              title: locale.settings.attemptsPerMinute,
              dataIndex: 'attempts',
              key: 'attempts',
              width: 140,
              render: (attempts) => (
                <Tag color="red">{attempts} 次</Tag>
              ),
            },
            {
              title: locale.settings.remainingBanTime,
              dataIndex: 'remainingTime',
              key: 'remainingTime',
              width: 180,
              render: (seconds) => (
                <Tag color="orange" icon={<ClockCircleOutlined />}>
                  {formatRemainingTime(seconds)}
                </Tag>
              ),
            },
            {
              title: locale.common.action,
              key: 'action',
              width: 280,
              render: (_, record) => (
                <Space>
                  <Select
                    style={{ width: 140 }}
                    size="small"
                    placeholder={locale.settings.modifyDuration}
                    options={[
                      { value: 5, label: '5 分钟' },
                      { value: 10, label: '10 分钟' },
                      { value: 30, label: '30 分钟' },
                      { value: 60, label: '1 小时' },
                      { value: 1440, label: '24 小时' },
                    ]}
                    onChange={(value) => handleUpdateBanDuration(record.ip, value)}
                  />
                  <Popconfirm
                    title={locale.settings.confirmUnban}
                    description={locale.settings.unbanDescription}
                    onConfirm={() => handleUnbanIP(record.ip)}
                    okText={locale.common.confirm}
                    cancelText={locale.common.cancel}
                  >
                    <Button
                      type="primary"
                      danger
                      size="small"
                      icon={<UnlockOutlined />}
                    >
                      {locale.settings.unban}
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </div>

      {/* 日志设置 */}
      <div className="settings-section">
        <div className="settings-section-title">{locale.settings.logs}</div>

        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.logRetentionDays}</div>
            <div className="settings-desc">{locale.settings.logRetentionDaysHint}</div>
          </div>
          <Select
            value={settings.logRetentionDays}
            onChange={(val) => updateSetting('logRetentionDays', val)}
            style={{ width: 140 }}
            options={[
              { value: 7, label: '7 天' },
              { value: 30, label: '30 天' },
              { value: 90, label: '90 天' },
              { value: -1, label: '永久保留' },
            ]}
          />
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">{locale.settings.logStoragePath}</div>
            <div className="settings-desc">{locale.settings.logStoragePathHint}</div>
          </div>
          <Space>
            <Text
              style={{
                maxWidth: 200,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block',
              }}
            >
              {settings.logStoragePath || '默认路径'}
            </Text>
            <Button
              icon={<FolderOpenOutlined />}
              size="small"
              onClick={handleChangeLogPath}
            >
              {locale.settings.changePath}
            </Button>
          </Space>
        </div>
      </div>

      {/* 底部操作按钮 */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 12,
        padding: '16px 0',
      }}>
        <Button
          icon={<UndoOutlined />}
          onClick={handleReset}
        >
          恢复默认设置
        </Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={handleSave}
        >
          {locale.common.save}
        </Button>
      </div>
    </div>
  );
};

export default SettingsPage;
