import React, { useState, useEffect } from 'react';
import { App, Card, Button, Typography, Space, Tag, Descriptions } from 'antd';
import {
  ReloadOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { UpdateInfo } from '../../shared/types';
import { useLanguage } from '../contexts/LanguageContext';
import logo from '../assets/logo.png';

const { Text, Title } = Typography;

function renderMarkdown(md: string): string {
  // 转义 HTML
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 代码块 (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // 行内代码 (`...`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 粗体 (**...**)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 链接 [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // 引用块 (> text → 连续合并)
  html = html.replace(/^&gt; (.+)$/gm, '<bq>$1</bq>');
  html = html.replace(/((?:<bq>.*<\/bq>\n?)+)/g, '<blockquote>$1</blockquote>');
  html = html.replace(/<bq>/g, '<p>');
  html = html.replace(/<\/bq>/g, '</p>');

  // 无序列表项：将连续的单行 - item 包装为 <ul>
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // 标题 (# / ## / ###)
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

  // 将文本行包装为 <p>（跳过已是 HTML 标签的行和空行）
  html = html.replace(/^(?!<[a-z])(.+)$/gm, '<p>$1</p>');

  // 清理多余空行和空标签
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/\n{2,}/g, '\n');
  html = html.replace(/\n/g, '');

  return html;
}

const AboutPage: React.FC = () => {
  const { message } = App.useApp();
  const { locale } = useLanguage();
  const [appVersion, setAppVersion] = useState('');
  const [versions, setVersions] = useState({ node: '', chrome: '', electron: '' });
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // 获取版本信息
    window.neilink.ipc.invoke('app:get-version').then((v) => setAppVersion(v as string));
    setVersions({
      node: window.neilink.versions.node,
      chrome: window.neilink.versions.chrome,
      electron: window.neilink.versions.electron,
    });
  }, []);

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      const result = await window.neilink.ipc.invoke('app:check-update') as UpdateInfo;
      setUpdateInfo(result);
      if (result.hasUpdate) {
        message.info(`${locale.about.newVersionFound}: v${result.latestVersion}`);
      } else {
        message.success(locale.about.alreadyLatest);
      }
    } catch {
      message.error(locale.about.checkError);
    } finally {
      setChecking(false);
    }
  };

  const handleDownload = () => {
    if (updateInfo?.downloadUrl) {
      window.open(updateInfo.downloadUrl, '_blank');
    }
  };

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        {locale.about.title}
      </Title>

      {/* 应用信息卡片 */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img
            src={logo}
            alt="NeiLink"
            style={{ width: 80, height: 80, marginBottom: 12 }}
          />
          <Title level={3} style={{ margin: 0 }}>NeiLink</Title>
          {appVersion && (
            <Text type="secondary">
              {locale.about.currentVersion}: v{appVersion}
            </Text>
          )}
        </div>

        <div style={{ textAlign: 'center' }}>
          <Space>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              loading={checking}
              onClick={handleCheckUpdate}
            >
              {checking ? locale.about.checking : locale.about.checkUpdate}
            </Button>
          </Space>

          {updateInfo && (
            <div style={{
              marginTop: 16,
              padding: 16,
              background: updateInfo.hasUpdate ? 'var(--color-success-bg, #f6ffed)' : 'var(--bg-tertiary, #fafafa)',
              borderRadius: 8,
              border: `1px solid ${updateInfo.hasUpdate ? 'var(--color-success, #52c41a)' : 'var(--border-primary, #d9d9d9)'}`,
            }}>
              {updateInfo.hasUpdate ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                    <CheckCircleOutlined style={{ color: 'var(--color-success, #52c41a)', fontSize: 16 }} />
                    <Text strong style={{ color: 'var(--color-success, #52c41a)' }}>
                      {locale.about.newVersionFound}: v{updateInfo.latestVersion}
                    </Text>
                  </div>
                  {updateInfo.releaseNotes && (
                    <div style={{ marginTop: 12 }}>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                        {locale.about.releaseNotes}:
                      </Text>
                      <div
                        className="release-notes"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(updateInfo.releaseNotes) }}
                        style={{
                          fontSize: 13,
                          color: 'var(--text-secondary, #666)',
                          background: 'var(--bg-primary, #fff)',
                          padding: 12,
                          borderRadius: 4,
                          border: '1px solid var(--border-secondary, #f0f0f0)',
                          maxHeight: 240,
                          overflow: 'auto',
                          textAlign: 'left',
                          lineHeight: 1.5,
                        }}
                      />
                    </div>
                  )}
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={handleDownload}
                    style={{ marginTop: 12 }}
                  >
                    {locale.about.downloadUpdate}
                  </Button>
                </div>
              ) : (
                <Tag icon={<CheckCircleOutlined />} color="green">
                  {locale.about.alreadyLatest}
                </Tag>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* 运行时版本卡片 */}
      <Card title={locale.about.runtimeVersions}>
        <Descriptions column={1} size="small">
          <Descriptions.Item
            label={
              <Space>
                <InfoCircleOutlined style={{ color: 'var(--color-primary, #1890ff)' }} />
                <span>{locale.about.electron}</span>
              </Space>
            }
          >
            <Tag>{versions.electron}</Tag>
          </Descriptions.Item>
          <Descriptions.Item
            label={
              <Space>
                <InfoCircleOutlined style={{ color: 'var(--color-primary, #1890ff)' }} />
                <span>{locale.about.chrome}</span>
              </Space>
            }
          >
            <Tag>{versions.chrome}</Tag>
          </Descriptions.Item>
          <Descriptions.Item
            label={
              <Space>
                <InfoCircleOutlined style={{ color: 'var(--color-primary, #1890ff)' }} />
                <span>{locale.about.node}</span>
              </Space>
            }
          >
            <Tag>{versions.node}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

export default AboutPage;
