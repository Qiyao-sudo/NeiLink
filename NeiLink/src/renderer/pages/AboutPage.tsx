import React, { useState, useEffect, useCallback } from 'react';
import { App, Card, Button, Typography, Space, Progress } from 'antd';
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
      warning:   'M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a.75.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
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
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadPaused, setDownloadPaused] = useState(false);

  useEffect(() => {
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

  const handleDownload = useCallback(async () => {
    if (!updateInfo?.assets?.length || downloading) return;
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadPaused(false);

    const unsubscribe = window.neilink.ipc.on('update:download-progress', (percent) => {
      if (typeof percent === 'number') {
        setDownloadProgress(percent);
        if (percent >= 100) setDownloadPaused(false);
      }
    });

    try {
      await window.neilink.ipc.invoke('app:download-update', updateInfo.assets);
    } catch {
      message.error(locale.about.checkError);
      setDownloading(false);
    } finally {
      unsubscribe();
    }
  }, [updateInfo, downloading, message, locale]);

  const handlePause = useCallback(async () => {
    await window.neilink.ipc.invoke('app:download-pause');
    setDownloadPaused(true);
  }, []);

  const handleResume = useCallback(async () => {
    setDownloadPaused(false);
    const unsubscribe = window.neilink.ipc.on('update:download-progress', (percent) => {
      if (typeof percent === 'number') {
        setDownloadProgress(percent);
        if (percent >= 100) setDownloadPaused(false);
      }
    });
    try {
      await window.neilink.ipc.invoke('app:download-resume');
    } catch {
      message.error(locale.about.checkError);
      setDownloading(false);
    } finally {
      unsubscribe();
    }
  }, [message, locale]);

  const handleCancel = useCallback(async () => {
    await window.neilink.ipc.invoke('app:download-cancel');
    setDownloading(false);
    setDownloadPaused(false);
    setDownloadProgress(0);
  }, []);

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        {locale.about.title}
      </Title>

      {/* 应用信息 */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <img src={logo} alt="NeiLink" style={{ width: 56, height: 56, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <Title level={4} style={{ margin: 0 }}>NeiLink</Title>
              {appVersion && <Text type="secondary">v{appVersion}</Text>}
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Space size={6}>
                <UserOutlined style={{ color: 'var(--text-secondary, #666)' }} />
                <Text type="secondary">{locale.about.author}:</Text>
                <Text>Qiyao-sudo</Text>
              </Space>
              <Space size={6}>
                <GithubOutlined style={{ color: 'var(--text-secondary, #666)' }} />
                <Text type="secondary">{locale.about.repository}:</Text>
                <a href="https://github.com/Qiyao-sudo/NeiLink" target="_blank" rel="noopener noreferrer">
                  github.com/Qiyao-sudo/NeiLink
                </a>
              </Space>
            </div>
          </div>
        </div>
      </Card>

      {/* 检查更新 */}
      <Card title={locale.about.checkUpdate} style={{ marginBottom: 16 }}>
        {/* 尚未检查 → 居中按钮 */}
        {!updateInfo && !checking && (
          <div style={{ textAlign: 'center' }}>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleCheckUpdate}
              disabled={downloading}
            >
              {locale.about.checkUpdate}
            </Button>
          </div>
        )}

        {/* 正在检查 */}
        {checking && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <Button type="primary" icon={<ReloadOutlined />} loading>
              {locale.about.checking}
            </Button>
          </div>
        )}

        {/* 已是最新 */}
        {updateInfo && !updateInfo.hasUpdate && !checking && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircleOutlined style={{ color: 'var(--color-success, #52c41a)', fontSize: 16 }} />
              <Text strong>{locale.about.alreadyLatest}</Text>
            </div>
            <Button size="small" icon={<ReloadOutlined />} onClick={handleCheckUpdate} disabled={downloading}>
              {locale.about.checkUpdate}
            </Button>
          </div>
        )}

        {/* 发现新版本 */}
        {updateInfo && updateInfo.hasUpdate && !checking && (
          <>
            {/* 版本横幅 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'var(--color-success-bg, #f6ffed)',
              border: '1px solid var(--color-success, #52c41a)',
              borderRadius: 6,
              marginBottom: updateInfo.releaseNotes ? 14 : 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircleOutlined style={{ color: 'var(--color-success, #52c41a)', fontSize: 16 }} />
                <Text strong style={{ color: 'var(--color-success, #52c41a)' }}>
                  v{updateInfo.currentVersion} → v{updateInfo.latestVersion}
                </Text>
              </div>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleCheckUpdate}
                disabled={downloading}
              >
                {locale.about.checkUpdate}
              </Button>
            </div>

            {/* 更新日志 */}
            {updateInfo.releaseNotes && (
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
                  {locale.about.releaseNotes}
                </Text>
                <div
                  className="release-notes"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(updateInfo.releaseNotes) }}
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary, #666)',
                    background: 'var(--bg-primary, #fff)',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border-secondary, #f0f0f0)',
                    maxHeight: 200,
                    overflow: 'auto',
                    textAlign: 'left',
                    lineHeight: 1.6,
                  }}
                />
              </div>
            )}

            {/* 下载 / 进度 */}
            {downloading ? (
              <div style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}>
                <Progress
                  percent={downloadProgress < 0 ? 100 : downloadProgress}
                  status={
                    downloadProgress < 0 ? 'exception'
                    : downloadPaused ? 'normal'
                    : downloadProgress < 100 ? 'active' : 'success'
                  }
                />
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 4,
                }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {downloadProgress < 0
                      ? locale.about.checkError
                      : downloadPaused
                        ? locale.about.downloadPaused
                        : downloadProgress < 100
                          ? locale.about.downloading
                          : locale.about.installing}
                  </Text>
                  <Space size={8}>
                    {downloadProgress >= 0 && downloadProgress < 100 && (
                      downloadPaused ? (
                        <Button size="small" type="primary" onClick={handleResume}>
                          {locale.about.downloadResume}
                        </Button>
                      ) : (
                        <Button size="small" onClick={handlePause}>
                          {locale.about.downloadPause}
                        </Button>
                      )
                    )}
                    {downloadProgress < 100 && (
                      <Button size="small" danger onClick={handleCancel}>
                        {locale.about.downloadCancel}
                      </Button>
                    )}
                  </Space>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <Button
                  type="primary"
                  size="large"
                  block
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                >
                  {locale.about.downloadUpdate}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* 运行时版本 */}
      <Card title={locale.about.runtimeVersions}>
        <div style={{ display: 'flex', gap: 12 }}>
          {([
            { label: locale.about.electron, value: versions.electron },
            { label: locale.about.chrome, value: versions.chrome },
            { label: locale.about.node, value: versions.node },
          ] as const).map(item => (
            <div key={item.label} style={{
              flex: 1,
              textAlign: 'center',
              padding: '8px 0',
              background: 'var(--bg-tertiary, #fafafa)',
              borderRadius: 6,
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary, #666)', marginBottom: 4 }}>
                {item.label}
              </div>
              <Text strong>{item.value}</Text>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default AboutPage;
