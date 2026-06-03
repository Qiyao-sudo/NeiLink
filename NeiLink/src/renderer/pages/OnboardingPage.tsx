import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Button,
  Switch,
  Select,
  Input,
  Avatar,
  Upload,
  Typography,
} from 'antd';
import {
  UserOutlined,
  WifiOutlined,
  ApartmentOutlined,
  CheckCircleOutlined,
  CameraOutlined,
  LaptopOutlined,
  ArrowRightOutlined,
  MinusOutlined,
  BorderOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import { IPC_CHANNELS } from '../../shared/types';
import logo from '../assets/logo.png';

const { Text } = Typography;

// 自定义还原图标
const CustomRestoreIcon = () => (
  <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor">
    <path d="M172.8 1017.6c-89.6 0-166.4-70.4-166.4-166.4V441.6c0-89.6 70.4-166.4 166.4-166.4h416c89.6 0 166.4 70.4 166.4 166.4v416c0 89.6-70.4 166.4-166.4 166.4l-416-6.4z m0-659.2c-51.2 0-89.6 38.4-89.6 89.6v416c0 51.2 38.4 89.6 89.6 89.6h416c51.2 0 89.6-38.4 89.6-89.6V441.6c0-51.2-38.4-89.6-89.6-89.6H172.8zM851.2 19.2H435.2C339.2 19.2 268.8 96 268.8 185.6v25.6h70.4v-25.6c0-51.2 38.4-89.6 89.6-89.6h409.6c51.2 0 89.6 38.4 89.6 89.6v409.6c0 51.2-38.4 89.6-89.6 89.6h-38.4V768h51.2c96 0 166.4-76.8 166.4-166.4V185.6c0-96-76.8-166.4-166.4-166.4z" />
  </svg>
);

/** 开箱体验顶栏（含窗口控制按钮） */
const OnboardingTopBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.neilink.ipc.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED).then((res: any) => {
      if (res?.success) setIsMaximized(res.isMaximized);
    });
    const unsub = window.neilink.ipc.on(IPC_CHANNELS.WINDOW_ON_STATE_CHANGE, (data: any) => {
      if (data?.isMaximized !== undefined) setIsMaximized(data.isMaximized);
    });
    return unsub;
  }, []);

  const handleAction = (action: 'minimize' | 'maximize' | 'close') => {
    if (action === 'close') {
      window.neilink.ipc.invoke('window:close');
      return;
    }
    window.neilink.ipc.invoke(`window:${action}`);
  };

  return (
    <div className="onboarding-topbar">
      <div className="onboarding-topbar-drag" />
      <div className="onboarding-topbar-controls">
        <Button type="text" size="small" icon={<MinusOutlined />} onClick={() => handleAction('minimize')} style={{ width: 36, height: 32 }} />
        <Button type="text" size="small" icon={isMaximized ? <CustomRestoreIcon /> : <BorderOutlined />} onClick={() => handleAction('maximize')} style={{ width: 36, height: 32 }} />
        <Button type="text" size="small" danger icon={<CloseOutlined />} onClick={() => handleAction('close')} style={{ width: 36, height: 32 }} />
      </div>
    </div>
  );
};

interface OnboardingSettings {
  userName: string;
  userAvatar?: string;
  floatWindowEnabled: boolean;
  autoStart: boolean;
  defaultEncrypt: boolean;
  defaultExtractCode: boolean;
  defaultExpiry: string;
  defaultMaxDownloads: number;
}

interface OnboardingPageProps {
  onComplete: (settings: OnboardingSettings) => void;
}

/* ========================================================================
 * 动画组件
 * ======================================================================== */

/** WiFi 连接动画：电脑1 → 网关 → 电脑2 */
const WifiAnimation: React.FC = () => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '24px 0' }}>
      <div className="onboarding-device-icon">
        <LaptopOutlined style={{ fontSize: 36 }} />
        <Text style={{ fontSize: 12, display: 'block', marginTop: 4 }}>PC 1</Text>
      </div>
      <div className="onboarding-arrow-chain">
        <div className="onboarding-dot-flow right" />
        <div style={{ textAlign: 'center' }}>
          <WifiOutlined style={{ fontSize: 24, color: 'var(--color-primary)' }} />
          <Text style={{ fontSize: 11, display: 'block', marginTop: 2 }}>WiFi</Text>
        </div>
        <div className="onboarding-dot-flow right" />
      </div>
      <div className="onboarding-device-icon">
        <LaptopOutlined style={{ fontSize: 36 }} />
        <Text style={{ fontSize: 12, display: 'block', marginTop: 4 }}>PC 2</Text>
      </div>
    </div>
  );
};

/** 网线连接动画：电脑1 → 网线 → 电脑2 */
const EthernetAnimation: React.FC = () => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '24px 0' }}>
      <div className="onboarding-device-icon">
        <LaptopOutlined style={{ fontSize: 36 }} />
        <Text style={{ fontSize: 12, display: 'block', marginTop: 4 }}>PC 1</Text>
      </div>
      <div className="onboarding-arrow-chain">
        <div className="onboarding-dot-flow right" />
        <div style={{ textAlign: 'center' }}>
          <ApartmentOutlined style={{ fontSize: 24, color: 'var(--color-success)' }} />
          <Text style={{ fontSize: 11, display: 'block', marginTop: 2 }}>LAN</Text>
        </div>
        <div className="onboarding-dot-flow right" />
      </div>
      <div className="onboarding-device-icon">
        <LaptopOutlined style={{ fontSize: 36 }} />
        <Text style={{ fontSize: 12, display: 'block', marginTop: 4 }}>PC 2</Text>
      </div>
    </div>
  );
};

/** 礼花动画 (CSS-based confetti) */
const ConfettiAnimation: React.FC = () => {
  const colors = ['#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#eb2f96'];
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 1.5 + Math.random() * 1.5,
    size: 6 + Math.random() * 6,
    rotation: Math.random() * 360,
  }));

  return (
    <div className="onboarding-confetti-container">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="onboarding-confetti-piece"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            width: p.size,
            height: p.size * 0.6,
            borderRadius: p.id % 3 === 0 ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  );
};

/* ========================================================================
 * 页面过渡组件
 * ======================================================================== */

/** 页面切换过渡动画：前进滑入 / 后退滑出 */
const PageTransition: React.FC<{
  page: number;
  direction: 'forward' | 'backward';
  children: React.ReactNode;
}> = ({ page, direction, children }) => {
  return (
    <div
      key={page}
      className={`onboarding-slide onboarding-slide-${direction}`}
    >
      {children}
    </div>
  );
};

/* ========================================================================
 * 主组件
 * ======================================================================== */

const OnboardingPage: React.FC<OnboardingPageProps> = ({ onComplete }) => {
  const { locale } = useLanguage();
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const videoRef = useRef<HTMLVideoElement>(null);

  const [settings, setSettings] = useState<OnboardingSettings>({
    userName: 'NeiLink用户',
    userAvatar: undefined,
    floatWindowEnabled: true,
    autoStart: false,
    defaultEncrypt: false,
    defaultExtractCode: true,
    defaultExpiry: '24h',
    defaultMaxDownloads: -1,
  });

  const updateSetting = <K extends keyof OnboardingSettings>(key: K, value: OnboardingSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const goToPage = (page: number) => {
    setDirection(page > currentPage ? 'forward' : 'backward');
    setCurrentPage(page);
  };

  const handleAvatarChange = useCallback((info: any) => {
    const file = info.file.originFileObj || info.file;
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        updateSetting('userAvatar', base64);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // 自动播放视频
  useEffect(() => {
    if (currentPage === 0 && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [currentPage]);

  const handleComplete = () => {
    onComplete(settings);
  };

  const ob = locale.onboarding;

  /* ---- 渲染当前页面内容 ---- */
  const renderPage = () => {
    switch (currentPage) {
      /* ---- PAGE 0: 视频 ---- */
      case 0:
        return (
          <PageTransition page={0} direction={direction}>
            <div className="onboarding-page onboarding-page-welcome">
              <div className="onboarding-welcome-hero">
                <div className="onboarding-welcome-badge">LAN File Sharing</div>
                <h1 className="onboarding-welcome-title">
                  {'NeiLink'.split('').map((char, i) => (
                    <span
                      key={i}
                      className="onboarding-title-char"
                      style={{ animationDelay: `${0.3 + i * 0.1}s` }}
                    >
                      {char}
                    </span>
                  ))}
                </h1>
                <p className="onboarding-welcome-subtitle">
                  Simple, fast, and secure file sharing across your local network.
                </p>
                <Button
                  type="primary"
                  size="large"
                  icon={<ArrowRightOutlined />}
                  onClick={() => goToPage(1)}
                  className="onboarding-start-btn"
                >
                  {ob.startConfig}
                </Button>
              </div>
              <div className="onboarding-welcome-video-wrapper">
                <video
                  ref={videoRef}
                  src="local-asset://NeiLink.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="onboarding-welcome-video"
                />
              </div>
            </div>
          </PageTransition>
        );

      /* ---- PAGE 1: 网络连接引导 ---- */
      case 1:
        return (
          <PageTransition page={1} direction={direction}>
            <div className="onboarding-page">
              <div className="onboarding-content">
                <h2 className="onboarding-title">{ob.page1Title}</h2>
                <p className="onboarding-subtitle">{ob.page1Desc}</p>

                <div className="onboarding-card">
                  <h3>{ob.page1Wifi}</h3>
                  <WifiAnimation />
                </div>

                <div className="onboarding-card">
                  <h3>{ob.page1Ethernet}</h3>
                  <EthernetAnimation />
                </div>
              </div>
              <div className="onboarding-footer">
                <Button onClick={() => goToPage(0)}>{locale.common.back}</Button>
                <Button type="primary" onClick={() => goToPage(2)}>
                  {locale.common.next}
                </Button>
              </div>
            </div>
          </PageTransition>
        );

      /* ---- PAGE 2: 头像和昵称 ---- */
      case 2:
        return (
          <PageTransition page={2} direction={direction}>
            <div className="onboarding-page">
              <div className="onboarding-content">
                <h2 className="onboarding-title">{ob.page2Title}</h2>
                <p className="onboarding-subtitle">{ob.page2Desc}</p>

                <div className="onboarding-card onboarding-card-center">
                  <Upload
                    showUploadList={false}
                    accept="image/*"
                    customRequest={({ onSuccess }) => onSuccess?.('ok')}
                    onChange={handleAvatarChange}
                  >
                    <div className="onboarding-avatar-wrapper">
                      <Avatar
                        size={80}
                        src={settings.userAvatar}
                        icon={!settings.userAvatar && <UserOutlined />}
                      />
                      <div className="onboarding-avatar-overlay">
                        <CameraOutlined style={{ fontSize: 24, color: '#fff' }} />
                      </div>
                    </div>
                  </Upload>
                  <Input
                    value={settings.userName}
                    onChange={(e) => updateSetting('userName', e.target.value)}
                    placeholder="NeiLink用户"
                    style={{ width: 240, marginTop: 16, textAlign: 'center' }}
                    maxLength={20}
                  />
                </div>
              </div>
              <div className="onboarding-footer">
                <Button onClick={() => goToPage(1)}>{locale.common.back}</Button>
                <Button type="primary" onClick={() => goToPage(3)}>
                  {locale.common.next}
                </Button>
              </div>
            </div>
          </PageTransition>
        );

      /* ---- PAGE 3: 偏好设置 ---- */
      case 3:
        return (
          <PageTransition page={3} direction={direction}>
            <div className="onboarding-page">
              <div className="onboarding-content">
                <h2 className="onboarding-title">{ob.page3Title}</h2>

                <div className="onboarding-preferences">
                  <div className="onboarding-pref-item">
                    <Text>{ob.page3FloatWindow}</Text>
                    <Switch
                      checked={settings.floatWindowEnabled}
                      onChange={(v) => updateSetting('floatWindowEnabled', v)}
                    />
                  </div>
                  <div className="onboarding-pref-item">
                    <Text>{ob.page3AutoStart}</Text>
                    <Switch
                      checked={settings.autoStart}
                      onChange={(v) => updateSetting('autoStart', v)}
                    />
                  </div>
                  <div className="onboarding-pref-item">
                    <Text>{ob.page3DefaultEncrypt}</Text>
                    <Switch
                      checked={settings.defaultEncrypt}
                      onChange={(v) => updateSetting('defaultEncrypt', v)}
                    />
                  </div>
                  <div className="onboarding-pref-item">
                    <Text>{ob.page3DefaultExtractCode}</Text>
                    <Switch
                      checked={settings.defaultExtractCode}
                      onChange={(v) => updateSetting('defaultExtractCode', v)}
                    />
                  </div>
                  <div className="onboarding-pref-item">
                    <Text>{ob.page3DefaultExpiry}</Text>
                    <Select
                      value={settings.defaultExpiry}
                      onChange={(v) => updateSetting('defaultExpiry', v)}
                      style={{ width: 140 }}
                      classNames={{ popup: { root: 'onboarding-select-popup' } }}
                      options={[
                        { value: '1h', label: `1 ${ob.hour}` },
                        { value: '6h', label: `6 ${ob.hour}` },
                        { value: '24h', label: `24 ${ob.hour}` },
                        { value: '7d', label: `7 ${ob.day}` },
                        { value: '30d', label: `30 ${ob.day}` },
                        { value: 'permanent', label: ob.permanent },
                      ]}
                    />
                  </div>
                  <div className="onboarding-pref-item">
                    <Text>{ob.page3DefaultMaxDownloads}</Text>
                    <Select
                      value={settings.defaultMaxDownloads}
                      onChange={(v) => updateSetting('defaultMaxDownloads', v)}
                      style={{ width: 140 }}
                      classNames={{ popup: { root: 'onboarding-select-popup' } }}
                      options={[
                        { value: 1, label: '1' },
                        { value: 5, label: '5' },
                        { value: 10, label: '10' },
                        { value: -1, label: ob.unlimited },
                      ]}
                    />
                  </div>
                </div>
              </div>
              <div className="onboarding-footer">
                <Button onClick={() => goToPage(2)}>{locale.common.back}</Button>
                <Button type="primary" onClick={() => goToPage(4)}>
                  {locale.common.next}
                </Button>
              </div>
            </div>
          </PageTransition>
        );

      /* ---- PAGE 4: 完成 ---- */
      case 4:
        return (
          <PageTransition page={4} direction={direction}>
            <div className="onboarding-page">
              <ConfettiAnimation />
              <div className="onboarding-content onboarding-content-center">
                <h2 className="onboarding-title" style={{ fontSize: 32 }}>
                  {ob.page4Title}
                </h2>
                <img src={logo} alt="NeiLink" style={{ width: 80, height: 80, borderRadius: '50%', margin: '24px 0' }} />
                <CheckCircleOutlined style={{ fontSize: 48, color: 'var(--color-success)' }} />
                <Button
                  type="primary"
                  size="large"
                  onClick={handleComplete}
                  style={{ marginTop: 32, minWidth: 160, height: 44, fontSize: 16 }}
                >
                  {ob.page4StartUsing}
                </Button>
              </div>
            </div>
          </PageTransition>
        );

      default:
        return null;
    }
  };

  return (
    <div className="onboarding-root">
      <OnboardingTopBar />
      <div className="onboarding-page-container">
        {renderPage()}
      </div>
    </div>
  );
};

export default OnboardingPage;
