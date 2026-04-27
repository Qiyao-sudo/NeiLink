import React, { useEffect, useState } from 'react';
import { App, Tag, Tooltip, Button } from 'antd';
import {
  MinusOutlined,
  BorderOutlined,
  CloseOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { NetworkInfo, IPC_CHANNELS } from '../../shared/types';
import { useLanguage } from '../contexts/LanguageContext';

// 自定义堆叠方块图标
const CustomRestoreIcon = () => (
  <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor">
    <path d="M172.8 1017.6c-89.6 0-166.4-70.4-166.4-166.4V441.6c0-89.6 70.4-166.4 166.4-166.4h416c89.6 0 166.4 70.4 166.4 166.4v416c0 89.6-70.4 166.4-166.4 166.4l-416-6.4z m0-659.2c-51.2 0-89.6 38.4-89.6 89.6v416c0 51.2 38.4 89.6 89.6 89.6h416c51.2 0 89.6-38.4 89.6-89.6V441.6c0-51.2-38.4-89.6-89.6-89.6H172.8zM851.2 19.2H435.2C339.2 19.2 268.8 96 268.8 185.6v25.6h70.4v-25.6c0-51.2 38.4-89.6 89.6-89.6h409.6c51.2 0 89.6 38.4 89.6 89.6v409.6c0 51.2-38.4 89.6-89.6 89.6h-38.4V768h51.2c96 0 166.4-76.8 166.4-166.4V185.6c0-96-76.8-166.4-166.4-166.4z" />
  </svg>
);

const TopBar: React.FC = () => {
  const { message } = App.useApp();
  const { locale } = useLanguage();
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    type: 'none',
    ip: '0.0.0.0',
    isOnline: false,
    adapters: [],
    selectedAdapter: undefined,
  });

  const [isMaximized, setIsMaximized] = useState(false);

  const fetchNetworkStatus = async () => {
    try {
      const result = await window.neilink.ipc.invoke('network:get-info') as any;
      if (result?.success && result.data) {
        setNetworkInfo(result.data as NetworkInfo);
      }
    } catch {
      // 静默处理，使用默认值
    }
  };

  const fetchWindowState = async () => {
    try {
      const result = await window.neilink.ipc.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED) as any;
      if (result?.success) {
        setIsMaximized(result.isMaximized);
      }
    } catch {
      // 静默处理
    }
  };

  useEffect(() => {
    fetchNetworkStatus();
    fetchWindowState();
    const interval = setInterval(fetchNetworkStatus, 5000);

    // 监听窗口状态变化
    const unsubscribe = window.neilink.ipc.on(IPC_CHANNELS.WINDOW_ON_STATE_CHANGE, (data: any) => {
      if (data?.isMaximized !== undefined) {
        setIsMaximized(data.isMaximized);
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  const copyIP = () => {
    navigator.clipboard.writeText(networkInfo.ip).then(() => {
      message.success(locale.common.copied);
    }).catch(() => {
      message.error(locale.error.networkError);
    });
  };

  const handleWindowAction = (action: 'minimize' | 'maximize' | 'close') => {
    window.neilink.ipc.invoke(`window:${action}`);
  };

  const networkTypeText = () => {
    if (networkInfo.isOnline) {
      return networkInfo.type === 'wifi' ? 'Wi-Fi' : locale.network.ethernet;
    } else {
      return locale.network.noNetwork;
    }
  };

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <div className="network-status">
          <span
            className={`network-status-dot ${networkInfo.isOnline ? 'online' : 'offline'}`}
          />
          <span style={{ fontSize: 13, color: '#666' }}>
            {networkInfo.isOnline ? locale.network.connected : locale.network.disconnected}
          </span>
          <span style={{ fontSize: 13, color: '#999' }}>
            ({networkTypeText()})
          </span>
        </div>
        <Tooltip title={locale.common.copy}>
          <Tag
            icon={<CopyOutlined />}
            color="blue"
            className="no-drag"
            style={{ cursor: 'pointer' }}
            onClick={copyIP}
          >
            {networkInfo.ip}
          </Tag>
        </Tooltip>
      </div>
      <div className="top-bar-right">
        <Button
          type="text"
          size="small"
          icon={<MinusOutlined />}
          onClick={() => handleWindowAction('minimize')}
          style={{ width: 32, height: 32 }}
        />
        <Button
          type="text"
          size="small"
          icon={isMaximized ? <CustomRestoreIcon /> : <BorderOutlined />}
          onClick={() => handleWindowAction('maximize')}
          style={{ width: 32, height: 32 }}
        />
        <Button
          type="text"
          size="small"
          danger
          icon={<CloseOutlined />}
          onClick={() => handleWindowAction('close')}
          style={{ width: 32, height: 32 }}
        />
      </div>
    </div>
  );
};

export default TopBar;
