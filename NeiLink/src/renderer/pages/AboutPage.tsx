import React, { useState, useEffect } from 'react';
import { App, Card, Button, Typography, Space, Tag, Descriptions } from 'antd';
import {
  ReloadOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  GithubOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { UpdateInfo } from '../../shared/types';
import { useLanguage } from '../contexts/LanguageContext';
import logo from '../assets/logo.png';

const { Text, Title } = Typography;

function renderMarkdown(md: string): string {
  const saved: string[] = [];

  // 保护已有 HTML <img> 标签，避免被转义
  let html = md.replace(/<img\s[^>]*\/?>/gi, (m) => {
    saved.push(m);
    return `\x00IMG${saved.length - 1}\x00`;
  });

  // 转义 HTML
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 代码块 (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // 行内代码 (`...`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 粗体 (**...**)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 图片 ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%" />');

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

  // 还原受保护的 <img> 标签
  html = html.replace(/\x00IMG(\d+)\x00/g, (_, i) => saved[parseInt(i)]);

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
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
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

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          marginBottom: 20,
        }}>
          <Space size={4}>
            <UserOutlined style={{ color: 'var(--text-secondary, #666)' }} />
            <Text type="secondary">{locale.about.author}:</Text>
            <Text>Qiyao-sudo</Text>
          </Space>
          <Space size={4}>
            <GithubOutlined style={{ color: 'var(--text-secondary, #666)' }} />
            <Text type="secondary">{locale.about.repository}:</Text>
            <a
              href="https://github.com/Qiyao-sudo/NeiLink"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/Qiyao-sudo/NeiLink
            </a>
          </Space>
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
            <div style={{ marginTop: 20 }}>
              {updateInfo.hasUpdate ? (
                <>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '10px 16px',
                    background: 'var(--color-success-bg, #f6ffed)',
                    border: '1px solid var(--color-success, #52c41a)',
                    borderLeft: '3px solid var(--color-success, #52c41a)',
                    borderRadius: 6,
                    marginBottom: 16,
                  }}>
                    <CheckCircleOutlined style={{ color: 'var(--color-success, #52c41a)', fontSize: 18 }} />
                    <Text strong style={{ color: 'var(--color-success, #52c41a)', fontSize: 15 }}>
                      {locale.about.newVersionFound}: v{updateInfo.latestVersion}
                    </Text>
                  </div>
                  {updateInfo.releaseNotes && (
                    <div style={{ marginBottom: 16 }}>
                      <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
                        {locale.about.releaseNotes}
                      </Text>
                      <div
                        className="release-notes"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(updateInfo.releaseNotes) }}
                        style={{
                          fontSize: 13,
                          color: 'var(--text-secondary, #666)',
                          background: 'var(--bg-primary, #fff)',
                          padding: '12px 16px',
                          borderRadius: 8,
                          border: '1px solid var(--border-secondary, #f0f0f0)',
                          maxHeight: 240,
                          overflow: 'auto',
                          textAlign: 'left',
                          lineHeight: 1.6,
                        }}
                      />
                    </div>
                  )}
                  <div style={{ textAlign: 'center' }}>
                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      onClick={handleDownload}
                    >
                      {locale.about.downloadUpdate}
                    </Button>
                  </div>
                </>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  background: 'var(--bg-tertiary, #fafafa)',
                  border: '1px solid var(--border-primary, #d9d9d9)',
                  borderLeft: '3px solid var(--color-success, #52c41a)',
                  borderRadius: 6,
                }}>
                  <CheckCircleOutlined style={{ color: 'var(--color-success, #52c41a)', fontSize: 18 }} />
                  <Text strong style={{ fontSize: 15 }}>
                    {locale.about.alreadyLatest}
                  </Text>
                </div>
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
