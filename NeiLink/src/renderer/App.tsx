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
import OnboardingPage from './pages/OnboardingPage';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';

const AppLayout: React.FC<{
  showOnboarding: boolean;
  onOnboardingComplete: () => void;
}> = ({ showOnboarding, onOnboardingComplete }) => {
  const { locale } = useLanguage();
  const { resolvedTheme } = useTheme();
  const { updateSettings } = useSettings();
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
    const unsubscribe = window.neilink.ipc.on('window:navigate', (path: unknown) => {
      if (typeof path === 'string') {
        navigate(path);
      }
    });
    return unsubscribe;
  }, [navigate]);

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  // 开箱体验完成后保存设置（通过 SettingsContext 立即持久化）
  const handleOnboardingComplete = (settings: any) => {
    try {
      updateSettings({
        userName: settings.userName,
        userAvatar: settings.userAvatar,
        floatWindowEnabled: settings.floatWindowEnabled,
        autoStart: settings.autoStart,
        defaultEncrypt: settings.defaultEncrypt,
        defaultExtractCode: settings.defaultExtractCode,
        defaultExpiry: settings.defaultExpiry,
        defaultMaxDownloads: settings.defaultMaxDownloads,
        onboardingCompleted: true,
      });
    } catch (err) {
      console.error('保存开箱设置失败:', err);
    }
    onOnboardingComplete();
  };

  if (showOnboarding) {
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
          <OnboardingPage onComplete={handleOnboardingComplete} />
        </AntdApp>
      </ConfigProvider>
    );
  }

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

const AppRoot: React.FC = () => {
  const { settings, loading } = useSettings();
  // 仅在设置首次加载完成后决定是否进入开箱体验，
  // 之后用本地状态记住“已完成开箱”，避免设置变化导致重复判断。
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading && onboardingDone === null) {
      setOnboardingDone(!!settings.onboardingCompleted);
    }
  }, [loading, settings.onboardingCompleted, onboardingDone]);

  if (loading || onboardingDone === null) return null;

  return (
    <LanguageProvider>
      <ThemeProvider>
        <AppLayout
          showOnboarding={!onboardingDone}
          onOnboardingComplete={() => setOnboardingDone(true)}
        />
      </ThemeProvider>
    </LanguageProvider>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <SettingsProvider>
        <AppRoot />
      </SettingsProvider>
    </HashRouter>
  );
};

export default App;
