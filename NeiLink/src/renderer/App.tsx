import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { App as AntdApp, Menu, ConfigProvider, theme as antTheme } from 'antd';
import {
  HomeOutlined,
  ShareAltOutlined,
  FileTextOutlined,
  SettingOutlined,
  BarChartOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import logo from './assets/logo.png';
import TopBar from './components/TopBar';
import HomePage from './pages/HomePage';
import ShareManagePage from './pages/ShareManagePage';
import LogPage from './pages/LogPage';
import SettingsPage from './pages/SettingsPage';
import StatsPage from './pages/StatsPage';
import AboutPage from './pages/AboutPage';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { SystemSettings, IPC_CHANNELS } from '../shared/types';

const AppLayout: React.FC = () => {
  const { locale } = useLanguage();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: locale.pages.home,
    },
    {
      key: '/shares',
      icon: <ShareAltOutlined />,
      label: locale.pages.shareManage,
    },
    {
      key: '/logs',
      icon: <FileTextOutlined />,
      label: locale.pages.log,
    },
    {
      key: '/stats',
      icon: <BarChartOutlined />,
      label: locale.pages.stats,
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: locale.pages.settings,
    },
    {
      key: '/about',
      icon: <InfoCircleOutlined />,
      label: locale.pages.about,
    },

  ];

  useEffect(() => {
    const unsubscribe = window.neilink.ipc.on(IPC_CHANNELS.WINDOW_NAVIGATE, (path: unknown) => {
      if (typeof path === 'string') {
        navigate(path);
      }
    });
    return unsubscribe;
  }, [navigate]);

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: resolvedTheme === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: resolvedTheme === 'dark' ? '#4da6ff' : '#1890ff',
        },
      }}
    >
      <AntdApp>
        <div className="app-layout">
          <div className="sidebar">
            <div className="sidebar-logo">
              <img src={logo} alt="NeiLink" style={{ width: 32, height: 32 }} />
              <span>NeiLink</span>
            </div>
            <Menu
              className="sidebar-menu"
              theme="dark"
              mode="inline"
              selectedKeys={[location.pathname]}
              items={menuItems}
              onClick={handleMenuClick}
            />
          </div>
          <div className="main-content">
            <TopBar />
            <div className="content-area">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/shares" element={<ShareManagePage />} />
                <Route path="/logs" element={<LogPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/stats" element={<StatsPage />} />
              <Route path="/about" element={<AboutPage />} />
              </Routes>
            </div>
          </div>
        </div>
      </AntdApp>
    </ConfigProvider>
  );
};

const App: React.FC = () => {
  const [initialSettings, setInitialSettings] = useState<SystemSettings>({
    autoStart: false,
    defaultNickname: 'NeiLink用户',
    defaultExtractCode: true,
    defaultExpiry: '24h',
    defaultMaxDownloads: -1,
    defaultMaxConcurrent: -1,
    port: 8080,
    hotspotPrefix: 'NeiLink',
    hotspotPasswordLength: 8,
    downloadSpeedLimit: 0,
    rateLimitEnabled: true,
    rateLimitMaxAttempts: 10,
    rateLimitBanDuration: 30,
    logRetentionDays: 30,
    logStoragePath: '',
    clearSharesOnExit: false,
    closeBehavior: 'ask',
    selectedAdapter: undefined,
    language: 'zh-CN',
    theme: 'auto',
    userName: 'NeiLink用户',
    userAvatar: undefined,
  });

  useEffect(() => {
    // 初始获取系统设置
    const fetchSettings = async () => {
      try {
        const result = await window.neilink.ipc.invoke('settings:get') as any;
        if (result?.success && result.data) {
          setInitialSettings(result.data as SystemSettings);
        }
      } catch (error) {
        console.error('获取系统设置失败:', error);
      }
    };

    fetchSettings();
  }, []);

  return (
    <HashRouter>
      <LanguageProvider initialSettings={initialSettings}>
        <ThemeProvider initialTheme={initialSettings.theme}>
          <AppLayout />
        </ThemeProvider>
      </LanguageProvider>
    </HashRouter>
  );
};

export default App;
