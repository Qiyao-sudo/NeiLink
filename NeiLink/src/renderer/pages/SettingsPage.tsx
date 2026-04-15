import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Switch,
  Input,
  Select,
  InputNumber,
  Button,
  Space,
  Typography,
  message,
  Divider,
} from 'antd';
import {
  SaveOutlined,
  UndoOutlined,
  FolderOpenOutlined,
  SearchOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;

interface AppSettings {
  // 基础设置
  autoStart: boolean;
  defaultNickname: string;
  useExtractionCode: boolean;
  defaultExpiry: string;
  defaultMaxDownloads: number;
  defaultMaxConcurrentDownloads: number;

  // 网络设置
  port: number;
  hotspotNamePrefix: string;
  hotspotPasswordLength: number;

  // 安全设置
  aesKeySize: 128 | 256;
  enableProtection: boolean;
  maxAttemptCount: number;
  banDuration: number;

  // 日志设置
  logRetentionDays: number;
  logStoragePath: string;
}

const defaultSettings: AppSettings = {
  autoStart: false,
  defaultNickname: '',
  useExtractionCode: true,
  defaultExpiry: '24h',
  defaultMaxDownloads: 10,
  defaultMaxConcurrentDownloads: 5,
  port: 8080,
  hotspotNamePrefix: 'NeiLink',
  hotspotPasswordLength: 12,
  aesKeySize: 256,
  enableProtection: true,
  maxAttemptCount: 5,
  banDuration: 30,
  logRetentionDays: 30,
  logStoragePath: '',
};

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.neilink.ipc.invoke('settings:get') as Partial<AppSettings>;
      if (result && typeof result === 'object') {
        setSettings({ ...defaultSettings, ...result });
      }
    } catch {
      message.error('获取设置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await window.neilink.ipc.invoke('settings:save', settings);
      message.success('配置已保存');
    } catch {
      message.error('保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      await window.neilink.ipc.invoke('settings:reset');
      setSettings(defaultSettings);
      message.success('已恢复默认设置');
    } catch {
      message.error('恢复默认设置失败');
    }
  };

  const handleDetectPort = async () => {
    try {
      const result = await window.neilink.ipc.invoke('network:detect-port', {
        startPort: settings.port,
      }) as number;
      if (result) {
        updateSetting('port', result);
        message.success(`检测到可用端口: ${result}`);
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

  return (
    <div>
      {/* 基础设置 */}
      <div className="settings-section">
        <div className="settings-section-title">基础设置</div>

        <div className="settings-item">
          <div>
            <div className="settings-label">开机自启</div>
            <div className="settings-desc">系统启动时自动运行 NeiLink</div>
          </div>
          <Switch
            checked={settings.autoStart}
            onChange={(val) => updateSetting('autoStart', val)}
          />
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">默认上传者昵称</div>
            <div className="settings-desc">创建分享时默认填写的昵称</div>
          </div>
          <Input
            value={settings.defaultNickname}
            onChange={(e) => updateSetting('defaultNickname', e.target.value)}
            placeholder="请输入昵称"
            maxLength={20}
            style={{ width: 200 }}
          />
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">默认使用提取码</div>
            <div className="settings-desc">创建分享时默认启用提取码</div>
          </div>
          <Switch
            checked={settings.useExtractionCode}
            onChange={(val) => updateSetting('useExtractionCode', val)}
          />
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">默认有效期</div>
            <div className="settings-desc">创建分享时的默认有效时长</div>
          </div>
          <Select
            value={settings.defaultExpiry}
            onChange={(val) => updateSetting('defaultExpiry', val)}
            style={{ width: 140 }}
            options={[
              { value: '1h', label: '1 小时' },
              { value: '6h', label: '6 小时' },
              { value: '24h', label: '24 小时' },
              { value: '7d', label: '7 天' },
              { value: '30d', label: '30 天' },
            ]}
          />
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">默认下载次数</div>
            <div className="settings-desc">创建分享时的默认最大下载次数</div>
          </div>
          <Select
            value={settings.defaultMaxDownloads}
            onChange={(val) => updateSetting('defaultMaxDownloads', val)}
            style={{ width: 140 }}
            options={[
              { value: 1, label: '1 次' },
              { value: 5, label: '5 次' },
              { value: 10, label: '10 次' },
              { value: 50, label: '50 次' },
              { value: -1, label: '不限次数' },
            ]}
          />
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">默认最大同时下载数</div>
            <div className="settings-desc">创建分享时的默认最大同时下载数</div>
          </div>
          <Select
            value={settings.defaultMaxConcurrentDownloads}
            onChange={(val) => updateSetting('defaultMaxConcurrentDownloads', val)}
            style={{ width: 140 }}
            options={[
              { value: 3, label: '3 个' },
              { value: 5, label: '5 个' },
              { value: 10, label: '10 个' },
              { value: -1, label: '不限' },
            ]}
          />
        </div>
      </div>

      {/* 网络设置 */}
      <div className="settings-section">
        <div className="settings-section-title">网络设置</div>

        <div className="settings-item">
          <div>
            <div className="settings-label">服务端口</div>
            <div className="settings-desc">HTTP 服务监听端口 (1-65535)</div>
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
              检测可用端口
            </Button>
          </Space>
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">热点名称前缀</div>
            <div className="settings-desc">创建热点时的默认名称前缀</div>
          </div>
          <Input
            value={settings.hotspotNamePrefix}
            onChange={(e) => updateSetting('hotspotNamePrefix', e.target.value)}
            placeholder="NeiLink"
            maxLength={20}
            style={{ width: 200 }}
          />
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">热点密码长度</div>
            <div className="settings-desc">自动生成热点密码的长度 (8-63)</div>
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
        <div className="settings-section-title">安全设置</div>

        <div className="settings-item">
          <div>
            <div className="settings-label">AES 加密密钥长度</div>
            <div className="settings-desc">文件传输加密使用的密钥长度</div>
          </div>
          <Select
            value={settings.aesKeySize}
            onChange={(val) => updateSetting('aesKeySize', val as 128 | 256)}
            style={{ width: 140 }}
            options={[
              { value: 128, label: '128 位' },
              { value: 256, label: '256 位' },
            ]}
          />
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">恶意访问防护</div>
            <div className="settings-desc">自动封禁异常访问的 IP 地址</div>
          </div>
          <Switch
            checked={settings.enableProtection}
            onChange={(val) => updateSetting('enableProtection', val)}
          />
        </div>

        {settings.enableProtection && (
          <>
            <div className="settings-item">
              <div>
                <div className="settings-label">最大尝试次数</div>
                <div className="settings-desc">超过此次数后自动封禁 IP</div>
              </div>
              <InputNumber
                value={settings.maxAttemptCount}
                onChange={(val) => val && updateSetting('maxAttemptCount', val)}
                min={1}
                max={100}
                style={{ width: 120 }}
              />
            </div>

            <div className="settings-item">
              <div>
                <div className="settings-label">封禁时长（分钟）</div>
                <div className="settings-desc">IP 被封禁的持续时间</div>
              </div>
              <InputNumber
                value={settings.banDuration}
                onChange={(val) => val && updateSetting('banDuration', val)}
                min={1}
                max={1440}
                style={{ width: 120 }}
              />
            </div>
          </>
        )}
      </div>

      {/* 日志设置 */}
      <div className="settings-section">
        <div className="settings-section-title">日志设置</div>

        <div className="settings-item">
          <div>
            <div className="settings-label">日志保留时长</div>
            <div className="settings-desc">超过此时长的日志将被自动清理</div>
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
            <div className="settings-label">日志存储路径</div>
            <div className="settings-desc">日志文件的存储目录</div>
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
              更改路径
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
          保存配置
        </Button>
      </div>
    </div>
  );
};

export default SettingsPage;
