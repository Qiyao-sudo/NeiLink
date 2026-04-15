import React from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'antd';
import {
  HomeOutlined,
  ShareAltOutlined,
  FileTextOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import logo from './assets/logo.png';
import TopBar from './components/TopBar';
import HomePage from './pages/HomePage';
import ShareManagePage from './pages/ShareManagePage';
import LogPage from './pages/LogPage';
import SettingsPage from './pages/SettingsPage';

const menuItems = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: '首页',
  },
  {
    key: '/shares',
    icon: <ShareAltOutlined />,
    label: '分享管理',
  },
  {
    key: '/logs',
    icon: <FileTextOutlined />,
    label: '日志查看',
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: '系统设置',
  },
];

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
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
          </Routes>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AppLayout />
    </HashRouter>
  );
};

export default App;
