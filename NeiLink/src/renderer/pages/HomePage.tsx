import React, { useState, useEffect, useCallback, useRef } from 'react';
import { App, Card, Button, Switch, Alert, Typography, Space, Select, Spin } from 'antd';
import {
  WifiOutlined,
  ApiOutlined,
  DisconnectOutlined,
  FolderAddOutlined,
  FileAddOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import ShareConfigModal, { ShareFormConfig, ShareResult } from '../components/ShareConfigModal';
import HotspotConfigModal from '../components/HotspotConfigModal';
import { NetworkInfo, ShareConfig } from '../../shared/types';
import { useLanguage } from '../contexts/LanguageContext';

const { Text, Title } = Typography;

interface HotspotStatus {
  enabled: boolean;
  ssid?: string;
  password?: string;
  error?: string;
  clients?: number;
}

const HomePage: React.FC = () => {
  const { message } = App.useApp();
  const { locale } = useLanguage();
  const [networkStatus, setNetworkStatus] = useState<NetworkInfo>({
    type: 'none',
    ip: '0.0.0.0',
    ips: [],
    isOnline: false,
    adapters: [],
    selectedAdapter: undefined,
    selectedAdapters: [],
  });
  const [hotspotInfo, setHotspotInfo] = useState<HotspotStatus>({
    enabled: false,
    ssid: '',
    password: '',
  });
  const [dragActive, setDragActive] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [hotspotModalVisible, setHotspotModalVisible] = useState(false);
  const [hotspotLoading, setHotspotLoading] = useState<'start' | 'stop' | null>(null);
  const [hotspotRandomPassword, setHotspotRandomPassword] = useState(true);
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [selectedIsFolder, setSelectedIsFolder] = useState(false);
  const [defaultSettings, setDefaultSettings] = useState({
    defaultExtractCode: true,
    defaultExpiry: '24h',
    defaultMaxDownloads: -1,
    defaultMaxConcurrent: -1,
    defaultEncrypt: false,
  });
  const dropRef = useRef<HTMLDivElement>(null);

  const fetchNetworkStatus = useCallback(async () => {
    try {
      const result = await window.neilink.ipc.invoke('network:get-info') as any;
      if (result?.success && result.data) {
        const newData = result.data as NetworkInfo;
        setNetworkStatus(prev => {
          if (
            prev.ip === newData.ip &&
            prev.type === newData.type &&
            prev.isOnline === newData.isOnline &&
            JSON.stringify(prev.ips) === JSON.stringify(newData.ips) &&
            JSON.stringify(prev.selectedAdapters) === JSON.stringify(newData.selectedAdapters)
          ) {
            return prev;
          }
          return newData;
        });
      }
    } catch {
      // 静默处理
    }
  }, []);

  const fetchHotspotStatus = useCallback(async () => {
    try {
      const result = await window.neilink.ipc.invoke('hotspot:status') as any;
      if (result?.success && result.data) {
        setHotspotInfo(result.data as HotspotStatus);
      }
    } catch {
      // 静默处理
    }
  }, []);

  const fetchDefaultSettings = useCallback(async () => {
    try {
      const result = await window.neilink.ipc.invoke('settings:get') as any;
      if (result?.success && result.data) {
        const settings = result.data as Record<string, unknown>;
        setDefaultSettings({
          defaultExtractCode: settings.defaultExtractCode as boolean ?? true,
          defaultExpiry: (settings.defaultExpiry as string) || '24h',
          defaultMaxDownloads: settings.defaultMaxDownloads as number ?? -1,
          defaultMaxConcurrent: settings.defaultMaxConcurrent as number ?? -1,
          defaultEncrypt: settings.defaultEncrypt as boolean ?? false,
        });
        setHotspotRandomPassword(settings.hotspotRandomPassword as boolean ?? true);
        setHotspotInfo(prev => ({
          ...prev,
          ssid: prev.ssid || (settings.hotspotSsid as string) || 'NeiLink',
          password: prev.password || (settings.hotspotPassword as string) || '',
        }));
      }
    } catch {
      // 静默处理
    }
  }, []);

  useEffect(() => {
    fetchNetworkStatus();
    fetchHotspotStatus();
    fetchDefaultSettings();
    const interval = setInterval(() => {
      fetchNetworkStatus();
      fetchHotspotStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchNetworkStatus, fetchHotspotStatus, fetchDefaultSettings]);

  useEffect(() => {
    const cleanup = window.neilink.ipc.on('float:open-share', (data: any) => {
      setSelectedFilePath(data.path);
      setSelectedIsFolder(data.isFolder);
      setShareModalVisible(true);
    });
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, []);

  // 拖拽处理
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      try {
        const filePath = window.neilink.getPathForFile(file);
        const result = await window.neilink.ipc.invoke('file:path-from-drop', filePath) as any;
        if (result?.success) {
          setSelectedFilePath(result.path);
          setSelectedIsFolder(result.isFolder);
          setShareModalVisible(true);
        } else {
          message.error('获取文件路径失败');
        }
      } catch {
        message.error('获取文件路径失败');
      }
    }
  };

  const handleSelectFile = async () => {
    try {
      const result = await window.neilink.ipc.invoke('file:select') as any;
      if (result?.success && result.files?.length > 0) {
        setSelectedFilePath(result.files[0]);
        setSelectedIsFolder(false);
        setShareModalVisible(true);
      }
    } catch {
      message.error('选择文件失败');
    }
  };

  const handleSelectFolder = async () => {
    try {
      const result = await window.neilink.ipc.invoke('file:select-folder') as any;
      if (result?.success && result.folder) {
        setSelectedFilePath(result.folder);
        setSelectedIsFolder(true);
        setShareModalVisible(true);
      }
    } catch {
      message.error('选择文件夹失败');
    }
  };

  const handleShareConfirm = async (config: ShareFormConfig): Promise<ShareResult | null> => {
    try {
      // 转换前端参数为后端期望的格式
      let expiryTime: number | null | undefined;
      if (config.expiry === 'permanent') {
        // 用户明确选择了永久
        expiryTime = null;
      } else if (config.expiry === '1h') {
        expiryTime = Date.now() + 60 * 60 * 1000;
      } else if (config.expiry === '6h') {
        expiryTime = Date.now() + 6 * 60 * 60 * 1000;
      } else if (config.expiry === '24h') {
        expiryTime = Date.now() + 24 * 60 * 60 * 1000;
      } else if (config.expiry === '7d') {
        expiryTime = Date.now() + 7 * 24 * 60 * 60 * 1000;
      } else if (config.expiry === '30d') {
        expiryTime = Date.now() + 30 * 24 * 60 * 60 * 1000;
      } else {
        // 未明确选择，使用默认设置
        expiryTime = undefined;
      }

      const shareParams = {
        filePath: config.filePath,
        isFolder: config.filePath.includes('\\') && config.filePath.endsWith('\\') ? true : false,
        extractCode: config.useExtractionCode ? config.extractionCode : undefined,
        expiryTime,
        maxDownloads: config.maxDownloads,
        maxConcurrent: config.maxConcurrentDownloads,
        encryptEnabled: config.encryptEnabled,
      };
      
      const result = await window.neilink.ipc.invoke('share:create', shareParams) as any;
      if (result?.success && result.data) {
        const shareConfig = result.data as ShareConfig;
        message.success('分享创建成功');
        return {
          shareLink: `http://${networkStatus.ip}:${shareConfig.port}/${shareConfig.id}`,
          shareLinks: networkStatus.ips.map(ip => ({
            ip,
            link: `http://${ip}:${shareConfig.port}/${shareConfig.id}`,
          })),
          extractionCode: shareConfig.extractCode || '',
          hotspotName: hotspotInfo.ssid || '',
          hotspotPassword: hotspotInfo.password || '',
        };
      }
      return null;
    } catch {
      message.error('分享创建失败');
      return null;
    }
  };

  const handleHotspotToggle = async (checked: boolean) => {
    setHotspotLoading(checked ? 'start' : 'stop');
    try {
      if (checked) {
        const result = await window.neilink.ipc.invoke('hotspot:start', {
          ssid: hotspotInfo.ssid || undefined,
          password: hotspotRandomPassword ? undefined : (hotspotInfo.password || undefined),
          randomPassword: hotspotRandomPassword,
        }) as any;
        if (result?.success && result.data) {
          const status = result.data as HotspotStatus;
          if (status.enabled) {
            message.success(locale.hotspot.toastStarted);
          } else if (status.error) {
            message.error(locale.hotspot.toastStartFailed.replace('{0}', status.error));
          }
        } else if (result?.error) {
          message.error(locale.hotspot.toastStartFailed.replace('{0}', result.error));
        }
      } else {
        const result = await window.neilink.ipc.invoke('hotspot:stop') as any;
        if (result?.success) {
          message.info(locale.hotspot.toastStopped);
        } else if (result?.error) {
          message.error(locale.hotspot.toastStopFailed.replace('{0}', result.error));
        }
      }
      fetchHotspotStatus();
    } catch {
      message.error(locale.hotspot.toastError);
    } finally {
      setHotspotLoading(null);
    }
  };

  const handleHotspotConfigSave = async (name: string, password: string, randomPassword: boolean): Promise<boolean> => {
    try {
      setHotspotRandomPassword(randomPassword);
      const configResult = await window.neilink.ipc.invoke('hotspot:config', { ssid: name, password, randomPassword }) as any;
      if (!configResult?.success) {
        message.error(locale.hotspot.toastConfigFailed);
        return false;
      }

      if (hotspotInfo.enabled) {
        await window.neilink.ipc.invoke('hotspot:stop');
        const startResult = await window.neilink.ipc.invoke('hotspot:start', {
          ssid: name,
          password: randomPassword ? undefined : password,
          randomPassword,
        }) as any;
        if (startResult?.success && startResult.data?.enabled) {
          message.success(locale.hotspot.toastConfigSuccess);
        } else {
          const errMsg = startResult?.data?.error || startResult?.error || locale.hotspot.toastError;
          message.error(locale.hotspot.toastStartFailed.replace('{0}', errMsg));
        }
      } else {
        message.success(locale.hotspot.toastConfigSuccess);
      }

      setHotspotModalVisible(false);
      fetchHotspotStatus();
      return true;
    } catch {
      message.error(locale.hotspot.toastConfigFailed);
      return false;
    }
  };

  const renderNetworkIcon = () => {
    if (networkStatus.isOnline) {
      return networkStatus.type === 'wifi' ? 
        <WifiOutlined style={{ fontSize: 24, color: '#1890ff' }} /> :
        <ApiOutlined style={{ fontSize: 24, color: '#1890ff' }} />;
    } else {
      return <DisconnectOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />;
    }
  };

  const copyIP = () => {
    navigator.clipboard.writeText(networkStatus.ip).then(() => {
      message.success('IP 地址已复制');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const handleAdapterChange = async (values: string[]) => {
    try {
      const result = await window.neilink.ipc.invoke('network:select-adapters', values) as any;
      if (result?.success && result.data) {
        setNetworkStatus(prev => ({
          ...prev,
          ips: result.data.ips,
          ip: result.data.ips[0] || prev.ip,
          selectedAdapter: result.data.adapterNames[0],
          selectedAdapters: result.data.adapterNames,
        }));
        message.success('适配器已切换');
      } else {
        message.error(result?.error || '切换适配器失败');
      }
    } catch {
      message.error('切换适配器失败');
    }
  };

  return (
    <div>
      {/* 网络状态区 */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {renderNetworkIcon()}
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>
                {networkStatus.isOnline ? locale.network.connected : locale.network.disconnected}
              </div>
              <div style={{ fontSize: 13, color: '#999', marginTop: 2 }}>
                {networkStatus.isOnline ? 
                  (networkStatus.type === 'wifi' ? 'Wi-Fi' : locale.network.ethernet) :
                  locale.network.noNetwork}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            {networkStatus.adapters.length > 1 && (
              <div style={{ minWidth: 220 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{locale.network.adapters}</div>
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  value={networkStatus.selectedAdapters}
                  onChange={handleAdapterChange}
                  maxTagCount="responsive"
                  options={networkStatus.adapters.map(adapter => {
                    const shortName = adapter.name.length > 20 ? adapter.name.slice(0, 20) + '…' : adapter.name;
                    return {
                      label: `${shortName} (${adapter.ip})`,
                      value: adapter.name,
                    };
                  })}
                />
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{locale.network.localIPs}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {networkStatus.ips.map((ip) => (
                  <Text
                    key={ip}
                    copyable={{ tooltips: [locale.common.copy, locale.common.copied] }}
                    style={{ fontSize: 14, fontWeight: 600 }}
                  >
                    {ip}
                  </Text>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 拖拽分享区 */}
      <Card style={{ marginBottom: 16 }}>
        <div
          ref={dropRef}
          className={`drop-zone ${dragActive ? 'active' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="drop-zone-icon">
            <CloudUploadOutlined />
          </div>
          <div className="drop-zone-text">
            {locale.home.dragText}
          </div>
          <div className="drop-zone-hint">
            {locale.home.dropHint}
          </div>
          <Space style={{ marginTop: 20 }}>
            <Button
              type="primary"
              icon={<FileAddOutlined />}
              onClick={handleSelectFile}
            >
              {locale.home.selectFile}
            </Button>
            <Button
              icon={<FolderAddOutlined />}
              onClick={handleSelectFolder}
            >
              {locale.home.selectFolder}
            </Button>
          </Space>
        </div>
      </Card>

      {/* 热点操作区 */}
      <Spin spinning={hotspotLoading !== null} tip={hotspotLoading === 'start' ? locale.hotspot.loadingStart : locale.hotspot.loadingStop} delay={300}>
      <div className="hotspot-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Title level={5} style={{ margin: 0 }}>{locale.hotspot.title}</Title>
            <Switch
              checked={hotspotInfo.enabled}
              onChange={handleHotspotToggle}
              loading={hotspotLoading !== null}
              checkedChildren={locale.hotspot.on}
              unCheckedChildren={locale.hotspot.off}
            />
          </div>
          <Button
            type="link"
            onClick={() => setHotspotModalVisible(true)}
          >
            {locale.hotspot.title}
          </Button>
        </div>

        {hotspotInfo.error && !hotspotInfo.enabled && (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 12 }}
            message={locale.hotspot.statusStopped}
            description={hotspotInfo.error}
          />
        )}

        {hotspotInfo.enabled && hotspotInfo.ssid && (
          <div style={{ marginTop: 12, display: 'flex', gap: 24 }}>
            <div>
              <Text type="secondary">{locale.hotspot.ssid}：</Text>
              <Text strong>{hotspotInfo.ssid}</Text>
            </div>
            {hotspotInfo.password && (
              <div>
                <Text type="secondary">{locale.hotspot.password}：</Text>
                <Text strong>{hotspotInfo.password}</Text>
              </div>
            )}
            {hotspotInfo.clients !== undefined && (
              <div>
                <Text type="secondary">{locale.hotspot.status}：</Text>
                <Text strong>{locale.hotspot.statusRunning} ({locale.hotspot.clientsCount.replace('{0}', String(hotspotInfo.clients))})</Text>
              </div>
            )}
          </div>
        )}

      </div>
      </Spin>

      {/* 分享配置弹窗 */}
      <ShareConfigModal
        visible={shareModalVisible}
        filePath={selectedFilePath}
        isFolder={selectedIsFolder}
        defaultExtractCode={defaultSettings.defaultExtractCode}
        defaultExpiry={defaultSettings.defaultExpiry}
        defaultMaxDownloads={defaultSettings.defaultMaxDownloads}
        defaultMaxConcurrent={defaultSettings.defaultMaxConcurrent}
        defaultEncrypt={defaultSettings.defaultEncrypt}
        onConfirm={handleShareConfirm}
        onCancel={() => setShareModalVisible(false)}
      />

      {/* 热点配置弹窗 */}
      <HotspotConfigModal
        visible={hotspotModalVisible}
        currentName={hotspotInfo.ssid || 'NeiLink'}
        currentPassword={hotspotInfo.password || ''}
        randomPasswordEnabled={hotspotRandomPassword}
        onConfirm={handleHotspotConfigSave}
        onCancel={() => setHotspotModalVisible(false)}
      />
    </div>
  );
};

export default HomePage;
