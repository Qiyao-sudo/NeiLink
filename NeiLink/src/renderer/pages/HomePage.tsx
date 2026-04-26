import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Button, Switch, Alert, Typography, Space, message, Select } from 'antd';
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
}

const HomePage: React.FC = () => {
  const { locale } = useLanguage();
  const [networkStatus, setNetworkStatus] = useState<NetworkInfo>({
    type: 'none',
    ip: '0.0.0.0',
    isOnline: false,
    adapters: [],
    selectedAdapter: undefined,
  });
  const [hotspotInfo, setHotspotInfo] = useState<HotspotStatus>({
    enabled: false,
    ssid: '',
    password: '',
  });
  const [dragActive, setDragActive] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [hotspotModalVisible, setHotspotModalVisible] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [selectedIsFolder, setSelectedIsFolder] = useState(false);
  const [defaultSettings, setDefaultSettings] = useState({
    defaultExtractCode: true,
    defaultExpiry: '24h',
    defaultMaxDownloads: -1,
    defaultMaxConcurrent: -1,
  });
  const dropRef = useRef<HTMLDivElement>(null);

  const fetchNetworkStatus = useCallback(async () => {
    try {
      const result = await window.neilink.ipc.invoke('network:get-info') as any;
      if (result?.success && result.data) {
        setNetworkStatus(result.data as NetworkInfo);
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
        });
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
      };
      
      const result = await window.neilink.ipc.invoke('share:create', shareParams) as any;
      if (result?.success && result.data) {
        const shareConfig = result.data as ShareConfig;
        message.success('分享创建成功');
        return {
          shareLink: `http://${networkStatus.ip}:${shareConfig.port}/${shareConfig.id}`,
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
    try {
      if (checked) {
        await window.neilink.ipc.invoke('hotspot:start');
        message.success('热点已开启');
      } else {
        await window.neilink.ipc.invoke('hotspot:stop');
        message.info('热点已关闭');
      }
      fetchHotspotStatus();
    } catch {
      message.error('操作热点失败');
    }
  };

  const handleHotspotConfigSave = async (name: string, password: string): Promise<boolean> => {
    try {
      await window.neilink.ipc.invoke('hotspot:config', { name, password });
      setHotspotModalVisible(false);
      fetchHotspotStatus();
      return true;
    } catch {
      message.error('保存热点配置失败');
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

  const handleAdapterChange = async (value: string) => {
    try {
      const result = await window.neilink.ipc.invoke('network:select-adapter', value) as any;
      if (result?.success && result.data) {
        // 更新网络状态
        setNetworkStatus(prev => ({
          ...prev,
          ip: result.data.ip,
          selectedAdapter: result.data.adapterName,
          // 重新获取完整的网络状态
        }));
        // 重新获取网络状态以更新所有信息
        fetchNetworkStatus();
        message.success('适配器已切换');
      } else {
        message.error(result?.error || '切换适配器失败');
      }
    } catch (error) {
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
              <div style={{ minWidth: 200 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{locale.network.adapter}</div>
                <Select
                  style={{ width: '100%' }}
                  value={networkStatus.selectedAdapter}
                  onChange={handleAdapterChange}
                  options={networkStatus.adapters.map(adapter => ({
                    label: `${adapter.name} (${adapter.ip})`,
                    value: adapter.name,
                  }))}
                />
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{locale.network.localIP}</div>
              <Text
                copyable={{ tooltips: [locale.common.copy, locale.common.copied] }}
                style={{ fontSize: 16, fontWeight: 600 }}
                onClick={copyIP}
              >
                {networkStatus.ip}
              </Text>
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
      <div className="hotspot-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Title level={5} style={{ margin: 0 }}>{locale.hotspot.title}</Title>
            <Switch
              checked={hotspotInfo.enabled}
              onChange={handleHotspotToggle}
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </div>
          <Button
            type="link"
            onClick={() => setHotspotModalVisible(true)}
          >
            {locale.hotspot.title}
          </Button>
        </div>

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
          </div>
        )}

        {hotspotInfo.enabled && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 12 }}
            message="AP 隔离提示"
            description="当前热点已启用 AP 隔离，连接同一热点的设备之间无法互相通信。如需局域网内设备互访，请在系统网络设置中关闭 AP 隔离。"
          />
        )}
      </div>

      {/* 分享配置弹窗 */}
      <ShareConfigModal
        visible={shareModalVisible}
        filePath={selectedFilePath}
        isFolder={selectedIsFolder}
        defaultExtractCode={defaultSettings.defaultExtractCode}
        defaultExpiry={defaultSettings.defaultExpiry}
        defaultMaxDownloads={defaultSettings.defaultMaxDownloads}
        defaultMaxConcurrent={defaultSettings.defaultMaxConcurrent}
        onConfirm={handleShareConfirm}
        onCancel={() => setShareModalVisible(false)}
      />

      {/* 热点配置弹窗 */}
      <HotspotConfigModal
        visible={hotspotModalVisible}
        currentName={hotspotInfo.ssid || ''}
        currentPassword={hotspotInfo.password || ''}
        onConfirm={handleHotspotConfigSave}
        onCancel={() => setHotspotModalVisible(false)}
      />
    </div>
  );
};

export default HomePage;
