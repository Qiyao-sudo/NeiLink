import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App } from 'antd';
import FloatWindow from './FloatWindow';

const AppContainer: React.FC = () => {
  return (
    <ConfigProvider theme={{ cssVar: false }}>
      <App>
        <FloatWindow />
      </App>
    </ConfigProvider>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<AppContainer />);
