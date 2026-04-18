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
  Table,
  Popconfirm,
  Tag,
} from 'antd';
import {
  SaveOutlined,
  UndoOutlined,
  FolderOpenOutlined,
  SearchOutlined,
  ReloadOutlined,
  UnlockOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { NetworkInfo, BannedIPInfo } from '../../shared/types';

const { Text, Title } = Typography;

interface AppSettings {
  // 基础设置
  autoStart: boolean;
  defaultNickname: string;
  defaultExtractCode: boolean;
  defaultExpiry: number;
  defaultMaxDownloads: number;
  defaultMaxConcurrent: number;
  clearSharesOnExit: boolean;

  // 网络设置
  port: number;
  hotspotPrefix: string;
  hotspotPasswordLength: number;

  // 安全设置
  encryptionBits: 128 | 256;
  rateLimitEnabled: boolean;
  rateLimitMaxAttempts: number;
  rateLimitBanDuration: number;

  // 日志设置
  logRetentionDays: number;
  logStoragePath: string;
}

const defaultSettings: AppSettings = {
  autoStart: false,
  defaultNickname: '',
  defaultExtractCode: true,
  defaultExpiry: 24,
  defaultMaxDownloads: 10,
  defaultMaxConcurrent: 5,
  clearSharesOnExit: false,
  port: 8080,
  hotspotPrefix: 'NeiLink',
  hotspotPasswordLength: 12,
  encryptionBits: 256,
  rateLimitEnabled: true,
  rateLimitMaxAttempts: 5,
  rateLimitBanDuration: 30,
  logRetentionDays: 30,
  logStoragePath: '',
};

const SettingsPage: React.FC = () => {
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

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.neilink.ipc.invoke('settings:get') as any;
      if (result?.success && result.data && typeof result.data === 'object') {
        setSettings({ ...defaultSettings, ...result.data });
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
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await window.neilink.ipc.invoke('settings:save', settings) as any;
      if (result?.success) {
        message.success('配置已保存');
      } else {
        message.error(result?.error || '保存配置失败');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
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
            checked={settings.defaultExtractCode}
            onChange={(val) => updateSetting('defaultExtractCode', val)}
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
              { value: 1, label: '1 小时' },
              { value: 6, label: '6 小时' },
              { value: 24, label: '24 小时' },
              { value: 168, label: '7 天' },
              { value: 720, label: '30 天' },
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
            value={settings.defaultMaxConcurrent}
            onChange={(val) => updateSetting('defaultMaxConcurrent', val)}
            style={{ width: 140 }}
            options={[
              { value: 3, label: '3 个' },
              { value: 5, label: '5 个' },
              { value: 10, label: '10 个' },
              { value: -1, label: '不限' },
            ]}
          />
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-label">关闭时删除分享</div>
            <div className="settings-desc">应用关闭时删除所有已分享的文件</div>
          </div>
          <Switch
            checked={settings.clearSharesOnExit}
            onChange={(val) => updateSetting('clearSharesOnExit', val)}
          />
        </div>
      </div>

      {/* 网络设置 */}
      <div className="settings-section">
        <div className="settings-section-title">网络设置</div>
        <div className="settings-item">
          <div>
            <div className="settings-label">网络适配器</div>
            <div className="settings-desc">选择用于文件分享的网络适配器</div>
          </div>
          <Select
            value={networkInfo.selectedAdapter}
            onChange={handleAdapterChange}
            style={{ width: 300 }}
            options={networkInfo.adapters.map(adapter => ({
              label: `${adapter.name} (${adapter.ip})`,
              value: adapter.name,
            }))}
            placeholder="选择网络适配器"
            disabled={networkInfo.adapters.length <= 1}
          />
        </div>
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
            value={settings.hotspotPrefix}
            onChange={(e) => updateSetting('hotspotPrefix', e.target.value)}
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
            value={settings.encryptionBits}
            onChange={(val) => updateSetting('encryptionBits', val as 128 | 256)}
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
            checked={settings.rateLimitEnabled}
            onChange={(val) => updateSetting('rateLimitEnabled', val)}
          />
        </div>

        {settings.rateLimitEnabled && (
          <>
            <div className="settings-item">
              <div>
                <div className="settings-label">最大尝试次数</div>
                <div className="settings-desc">每分钟超过此次数后自动封禁 IP</div>
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
                <div className="settings-label">封禁时长（分钟）</div>
                <div className="settings-desc">IP 被封禁的持续时间</div>
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
          <div className="settings-section-title">封禁IP管理</div>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchBannedIPs}
            loading={bannedIPsLoading}
            size="small"
          >
            刷新
          </Button>
        </div>

        <Table
          dataSource={bannedIPs}
          loading={bannedIPsLoading}
          rowKey="ip"
          pagination={false}
          size="small"
          locale={{ emptyText: '当前没有被封禁的IP' }}
          columns={[
            {
              title: 'IP地址',
              dataIndex: 'ip',
              key: 'ip',
              width: 180,
              render: (ip) => <Text strong>{ip}</Text>,
            },
            {
              title: '每分钟尝试次数',
              dataIndex: 'attempts',
              key: 'attempts',
              width: 140,
              render: (attempts) => (
                <Tag color="red">{attempts} 次</Tag>
              ),
            },
            {
              title: '剩余封禁时间',
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
              title: '操作',
              key: 'action',
              width: 280,
              render: (_, record) => (
                <Space>
                  <Select
                    style={{ width: 140 }}
                    size="small"
                    placeholder="修改时长"
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
                    title="确定要解封此IP吗？"
                    description={`解封后，该IP将恢复正常访问权限。`}
                    onConfirm={() => handleUnbanIP(record.ip)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      type="primary"
                      danger
                      size="small"
                      icon={<UnlockOutlined />}
                    >
                      解封
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
