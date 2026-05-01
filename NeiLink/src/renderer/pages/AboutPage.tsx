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

  // GitHub 风格提示标签（必须在引用块之前处理）
  html = html.replace(/^(&gt; )?\[!(note|tip|important|warning|caution)\]\s*$/gmi, (_, prefix, type) => {
    const t = type.toLowerCase();
    const svg = (d: string) => `<svg class="markdown-alert-icon" viewBox="0 0 16 16" width="16" height="16"><path d="${d}"/></svg>`;
    const icons: Record<string, string> = {
      note:      'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
      tip:       'M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z',
      important: 'M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
      warning:   'M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
      caution:   'M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
    };
    const labels: Record<string, string> = {
      note: 'note', tip: 'tip', important: 'important', warning: 'warning', caution: 'caution',
    };
    return `<p><span class="markdown-alert ${t}">${svg(icons[t])} ${labels[t]}</span></p>`;
  });

  // 引用块 (> text → 连续合并)
  html = html.replace(/^&gt; (.+)$/gm, '<bq>$1</bq>');
  html = html.replace(/((?:<bq>.*<\/bq>\n?)+)/g, '<blockquote>$1</blockquote>');
  html = html.replace(/<bq>/g, '<p>');
  html = html.replace(/<\/bq>/g, '</p>');

  // 无序列表项：将连续的单行 - item 包装为 <ul>
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // 标题 (# / ## / ### / ####)
  html = html.replace(/^#### (.+)$/gm, '<h5>$1</h5>');
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
