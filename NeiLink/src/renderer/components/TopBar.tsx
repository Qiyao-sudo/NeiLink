import React, { useEffect, useState } from 'react';
import { Tag, Tooltip, Button } from 'antd';
import {
  MinusOutlined,
  BorderOutlined,
  CloseOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { message } from 'antd';
import { NetworkInfo } from '../../shared/types';

const TopBar: React.FC = () => {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    type: 'none',
    ip: '0.0.0.0',
    isOnline: false,
  });

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

  useEffect(() => {
    fetchNetworkStatus();
    const interval = setInterval(fetchNetworkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const copyIP = () => {
    navigator.clipboard.writeText(networkInfo.ip).then(() => {
      message.success('IP 地址已复制');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const handleWindowAction = (action: 'minimize' | 'maximize' | 'close') => {
    window.neilink.ipc.invoke(`window:${action}`);
  };

  const networkTypeText = () => {
    switch (networkInfo.type) {
      case 'wifi': return 'Wi-Fi';
      case 'ethernet': return '以太网';
      default: return '未连接';
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
            {networkInfo.isOnline ? '已连接' : '未连接'}
          </span>
          <span style={{ fontSize: 13, color: '#999' }}>
            ({networkTypeText()})
          </span>
        </div>
        <Tooltip title="点击复制 IP 地址">
          <Tag
            icon={<CopyOutlined />}
            color="blue"
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
          icon={<BorderOutlined />}
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
