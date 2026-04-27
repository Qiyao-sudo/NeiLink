/**
 * NeiLink 接收端页面生成器
 * 生成内嵌在HTTP服务器中返回的完整HTML页面
 */

import type { ServerResponse } from 'http';

export interface ShareInfo {
  fileName: string;
  fileSize: number;
  uploaderName: string;
  hasExtractCode: boolean;
  expiryTime?: number;
  remainingDownloads?: number;
  isFolder?: boolean;
  shareId?: string;
  userAvatar?: string;
  userName?: string;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  return size.toFixed(i === 0 ? 0 : 2) + ' ' + units[i];
}

/**
 * 根据文件扩展名获取文件图标SVG
 */
function getFileIconSVG(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  let iconColor = '#1890FF';
  let iconText = 'FILE';

  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(ext)) {
    iconColor = '#52C41A';
    iconText = 'IMG';
  } else if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
    iconColor = '#722ED1';
    iconText = 'VID';
  } else if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'].includes(ext)) {
    iconColor = '#EB2F96';
    iconText = 'AUD';
  } else if (['pdf'].includes(ext)) {
    iconColor = '#F5222D';
    iconText = 'PDF';
  } else if (['doc', 'docx'].includes(ext)) {
    iconColor = '#1890FF';
    iconText = 'DOC';
  } else if (['xls', 'xlsx'].includes(ext)) {
    iconColor = '#52C41A';
    iconText = 'XLS';
  } else if (['ppt', 'pptx'].includes(ext)) {
    iconColor = '#FA8C16';
    iconText = 'PPT';
  } else if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
    iconColor = '#FAAD14';
    iconText = 'ZIP';
  } else if (['txt', 'md', 'log'].includes(ext)) {
    iconColor = '#8C8C8C';
    iconText = 'TXT';
  } else if (['js', 'ts', 'py', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'rb', 'php', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'sh', 'bat'].includes(ext)) {
    iconColor = '#13C2C2';
    iconText = 'CODE';
  } else if (['exe', 'msi', 'dmg', 'app', 'deb', 'rpm', 'apk'].includes(ext)) {
    iconColor = '#F5222D';
    iconText = 'APP';
  }

  return `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="4" width="36" height="48" rx="4" fill="${iconColor}" opacity="0.15"/>
    <rect x="12" y="8" width="36" height="48" rx="4" fill="white" stroke="${iconColor}" stroke-width="2"/>
    <path d="M36 8V16C36 18.2091 37.7909 20 40 20H48" stroke="${iconColor}" stroke-width="2" fill="white"/>
    <text x="30" y="42" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="${iconColor}" text-anchor="middle">${iconText}</text>
  </svg>`;
}

/**
 * 生成接收端HTML页面
 */
export function generateReceiverHTML(shareInfo: ShareInfo): string {
  const {
    fileName,
    fileSize,
    uploaderName,
    hasExtractCode,
    expiryTime,
    remainingDownloads,
    isFolder,
    shareId,
    userAvatar,
    userName,
  } = shareInfo;

  const formattedSize = formatFileSize(fileSize);
  const fileIcon = getFileIconSVG(fileName);
  const expiryText = expiryTime ? formatExpiryTime(expiryTime) : '永久有效';
  
  // 确定显示的上传者名称：优先使用 userName，然后是 uploaderName
  const displayName = userName || uploaderName;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="icon" type="image/x-icon" href="/NeiLink.ico">
<link rel="shortcut icon" type="image/x-icon" href="/NeiLink.ico">
<title>文件分享 - ${escapeHtml(fileName)}</title>
<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
      'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    background: #F0F2F5;
    color: #333;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 20px 16px;
  }

  .container {
    width: 100%;
    max-width: 600px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    overflow: hidden;
  }

  /* ===== 页面通用头部 ===== */
  .page-header {
    background: linear-gradient(135deg, #E6F7FF 0%, #BAE7FF 100%);
    padding: 32px 24px 24px;
    text-align: center;
  }

  .page-header .logo-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 12px;
  }

  .page-header h1 {
    font-size: 20px;
    font-weight: 600;
    color: #1890FF;
    margin-bottom: 4px;
  }

  .page-header .subtitle {
    font-size: 14px;
    color: #666;
  }

  /* ===== 页面内容区 ===== */
  .page-body {
    padding: 24px;
  }

  /* ===== 验证页面 ===== */
  #verify-page {
    display: none;
  }

  .verify-section {
    text-align: center;
  }

  .verify-section .file-icon-large {
    margin-bottom: 16px;
  }

  .verify-input-wrapper {
    position: relative;
    margin: 20px 0 8px;
  }

  .verify-input {
    width: 100%;
    height: 48px;
    border: 2px solid #D9D9D9;
    border-radius: 8px;
    padding: 0 16px;
    font-size: 16px;
    text-align: center;
    letter-spacing: 2px;
    outline: none;
    transition: border-color 0.3s;
  }

  .verify-input:focus {
    border-color: #1890FF;
  }

  .verify-input.error {
    border-color: #F5222D;
  }

  .verify-input:disabled {
    background: #F5F5F5;
    color: #BFBFBF;
    cursor: not-allowed;
  }

  .verify-hint {
    font-size: 12px;
    color: #999;
    margin-top: 8px;
  }

  .verify-error {
    color: #F5222D;
    font-size: 14px;
    margin-top: 12px;
    min-height: 20px;
    transition: opacity 0.3s;
  }

  .verify-rate-limit {
    color: #FAAD14;
    font-size: 14px;
    margin-top: 12px;
  }

  .verify-btn {
    width: 100%;
    height: 48px;
    background: #1890FF;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    margin-top: 20px;
    transition: background 0.3s, opacity 0.3s;
  }

  .verify-btn:hover {
    background: #40A9FF;
  }

  .verify-btn:active {
    background: #096DD9;
  }

  .verify-btn:disabled {
    background: #D9D9D9;
    cursor: not-allowed;
  }

  .expiry-info {
    margin-top: 16px;
    font-size: 13px;
    color: #999;
  }

  /* ===== 下载页面 ===== */
  #download-page {
    display: none;
  }

  .file-info-card {
    background: #FAFAFA;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 24px;
  }

  .file-info-top {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;
  }

  .file-info-icon {
    flex-shrink: 0;
  }

  .file-info-details {
    flex: 1;
    min-width: 0;
  }

  .file-name {
    font-size: 16px;
    font-weight: 600;
    color: #333;
    word-break: break-all;
    line-height: 1.4;
    margin-bottom: 8px;
  }

  .file-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
  }

  .file-meta-item {
    font-size: 13px;
    color: #666;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .file-meta-item .meta-label {
    color: #999;
  }

  .folder-badge {
    display: inline-block;
    background: #FFF7E6;
    color: #FA8C16;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid #FFD591;
    margin-top: 8px;
  }

  /* 下载按钮区域 */
  .download-actions {
    margin-bottom: 24px;
  }

  .download-btn {
    width: 100%;
    height: 52px;
    background: linear-gradient(135deg, #1890FF 0%, #096DD9 100%);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: opacity 0.3s, transform 0.1s;
    box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
  }

  .download-btn:hover {
    opacity: 0.9;
  }

  .download-btn:active {
    transform: scale(0.98);
  }

  .download-btn:disabled {
    background: #D9D9D9;
    box-shadow: none;
    cursor: not-allowed;
  }

  .download-btn svg {
    width: 20px;
    height: 20px;
  }

  .resume-actions {
    display: none;
    gap: 12px;
    margin-top: 12px;
  }

  .resume-actions.show {
    display: flex;
  }

  .resume-btn {
    flex: 1;
    height: 44px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.3s;
  }

  .resume-btn.continue {
    background: #1890FF;
    color: #fff;
    border: none;
  }

  .resume-btn.restart {
    background: #fff;
    color: #666;
    border: 1px solid #D9D9D9;
  }

  .resume-btn:hover {
    opacity: 0.85;
  }

  /* 进度条区域 */
  .progress-section {
    display: none;
    margin-bottom: 24px;
  }

  .progress-section.show {
    display: block;
  }

  .progress-bar-wrapper {
    width: 100%;
    height: 8px;
    background: #F0F0F0;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 12px;
  }

  .progress-bar {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #1890FF 0%, #52C41A 100%);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    color: #666;
  }

  .progress-percentage {
    font-weight: 600;
    color: #1890FF;
  }

  .progress-speed {
    color: #999;
  }

  .progress-remaining {
    color: #999;
  }

  /* 下载成功提示 */
  .download-success {
    display: none;
    text-align: center;
    padding: 16px 0;
  }

  .download-success.show {
    display: block;
  }

  .success-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 12px;
  }

  .success-text {
    font-size: 16px;
    color: #52C41A;
    font-weight: 500;
    margin-bottom: 8px;
  }

  /* 提示信息区 */
  .tips-section {
    border-top: 1px solid #F0F0F0;
    padding-top: 16px;
  }

  .tip-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    color: #999;
    margin-bottom: 8px;
    line-height: 1.5;
  }

  .tip-item:last-child {
    margin-bottom: 0;
  }

  .tip-icon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    margin-top: 1px;
  }

  /* ===== 异常页面 ===== */
  #error-page {
    display: none;
  }

  .error-section {
    text-align: center;
    padding: 40px 24px;
  }

  .error-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 20px;
  }

  .error-title {
    font-size: 18px;
    font-weight: 600;
    color: #F5222D;
    margin-bottom: 8px;
  }

  .error-message {
    font-size: 14px;
    color: #666;
    margin-bottom: 24px;
    line-height: 1.6;
  }

  .error-btn {
    height: 40px;
    padding: 0 24px;
    background: #fff;
    color: #666;
    border: 1px solid #D9D9D9;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: border-color 0.3s, color 0.3s;
  }

  .error-btn:hover {
    border-color: #1890FF;
    color: #1890FF;
  }

  /* ===== 加载动画 ===== */
  .loading-spinner {
    display: inline-block;
    width: 24px;
    height: 24px;
    border: 3px solid #E6F7FF;
    border-top-color: #1890FF;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ===== 响应式设计 ===== */
  @media (max-width: 768px) {
    body {
      padding: 0;
      background: #F0F2F5;
      align-items: stretch;
    }

    .container {
      max-width: 100%;
      border-radius: 0;
      box-shadow: none;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .page-header {
      padding: 24px 16px 20px;
    }

    .page-header h1 {
      font-size: 18px;
    }

    .page-body {
      padding: 16px;
      flex: 1;
    }

    .file-info-top {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .file-meta {
      justify-content: center;
    }

    .download-btn {
      height: 48px;
      font-size: 16px;
    }

    .resume-actions {
      flex-direction: column;
    }

    .error-section {
      padding: 24px 16px;
    }
  }
</style>
</head>
<body>
<div class="container">

  <!-- ===== 页面头部 ===== -->
  <div class="page-header">
    ${userAvatar ? `<img class="logo-icon" src="${userAvatar}" alt="用户头像" style="border-radius: 50%; object-fit: cover;"/>` : `<svg class="logo-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="20" fill="#1890FF" opacity="0.1"/>
      <path d="M24 16c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8zm0 2c-3.314 0-6 2.686-6 6s2.686 6 6 6 6-2.686 6-6-2.686-6-6-6zm0-4c-5.523 0-10 4.477-10 10s4.477 10 10 10 10-4.477 10-10-4.477-10-10-10z" fill="#1890FF" opacity="0.6"/>
    </svg>`}
    <h1>${escapeHtml(displayName)}</h1>
    <p class="subtitle">分享文件</p>
  </div>

  <!-- ===== 验证页面 ===== -->
  <div id="verify-page" class="page-body">
    <div class="verify-section">
      <div class="file-icon-large">
        ${fileIcon}
      </div>
      <div class="verify-input-wrapper">
        <input
          type="text"
          id="extract-code-input"
          class="verify-input"
          placeholder="请输入提取码"
          maxlength="8"
          autocomplete="off"
        />
      </div>
      <p class="verify-hint">支持纯数字、字母、混合格式</p>
      <div id="verify-error" class="verify-error"></div>
      <div id="verify-rate-limit" class="verify-rate-limit" style="display:none;">
        操作频繁，请10分钟后再试
      </div>
      <button id="verify-btn" class="verify-btn" disabled>确认验证</button>
      <p class="expiry-info">分享有效期：${escapeHtml(expiryText)}</p>
    </div>
  </div>

  <!-- ===== 下载页面 ===== -->
  <div id="download-page" class="page-body">
    <!-- 文件信息区 -->
    <div class="file-info-card">
      <div class="file-info-top">
        <div class="file-info-icon">
          ${fileIcon}
        </div>
        <div class="file-info-details">
          <div class="file-name" id="display-file-name">${escapeHtml(fileName)}</div>
          <div class="file-meta">
              <div class="file-meta-item">
                <span class="meta-label">大小：</span>
                <span>${escapeHtml(formattedSize)}</span>
              </div>
              <div class="file-meta-item">
                <span class="meta-label">上传者：</span>
                <span>${escapeHtml(displayName)}</span>
              </div>
            <div class="file-meta-item">
              <span class="meta-label">有效期：</span>
              <span>${escapeHtml(expiryText)}</span>
            </div>
            ${remainingDownloads !== undefined ? `
            <div class="file-meta-item">
              <span class="meta-label">剩余次数：</span>
              <span>${remainingDownloads}</span>
            </div>` : ''}
          </div>
          ${isFolder ? '<div class="folder-badge">ZIP 打包下载</div>' : ''}
        </div>
      </div>
    </div>

    <!-- 下载操作区 -->
    <div class="download-actions">
      <button id="download-btn" class="download-btn">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5M4 16h12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        下载
      </button>
      <div id="resume-actions" class="resume-actions">
        <button id="resume-btn" class="resume-btn continue">继续下载</button>
        <button id="restart-btn" class="resume-btn restart">重新下载</button>
      </div>
    </div>

    <!-- 进度条区域 -->
    <div id="progress-section" class="progress-section">
      <div class="progress-bar-wrapper">
        <div id="progress-bar" class="progress-bar"></div>
      </div>
      <div class="progress-info">
        <span id="progress-percentage" class="progress-percentage">0%</span>
        <span id="progress-speed" class="progress-speed"></span>
        <span id="progress-remaining" class="progress-remaining"></span>
      </div>
    </div>

    <!-- 下载成功提示 -->
    <div id="download-success" class="download-success">
      <svg class="success-icon" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="20" fill="#52C41A" opacity="0.1"/>
        <circle cx="24" cy="24" r="20" stroke="#52C41A" stroke-width="2" fill="none"/>
        <path d="M15 24l6 6 12-12" stroke="#52C41A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div class="success-text">下载完成</div>
    </div>

    <!-- 提示信息区 -->
    <div class="tips-section">
      <div class="tip-item">
        <svg class="tip-icon" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="#1890FF" stroke-width="1.5" fill="none"/>
          <path d="M8 7v4M8 5v0" stroke="#1890FF" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>下载完成后可直接打开文件</span>
      </div>
      <div class="tip-item">
        <svg class="tip-icon" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="#1890FF" stroke-width="1.5" fill="none"/>
          <path d="M8 7v4M8 5v0" stroke="#1890FF" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>若下载中断，重新访问链接即可继续下载</span>
      </div>
    </div>
  </div>

  <!-- ===== 异常页面 ===== -->
  <div id="error-page" class="page-body">
    <div class="error-section">
      <svg class="error-icon" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="28" fill="#F5222D" opacity="0.08"/>
        <circle cx="32" cy="32" r="28" stroke="#F5222D" stroke-width="2" fill="none"/>
        <path d="M32 20v14M32 42v0" stroke="#F5222D" stroke-width="3" stroke-linecap="round"/>
      </svg>
      <div id="error-title" class="error-title">出错了</div>
      <div id="error-message" class="error-message">请稍后再试</div>
      <button id="error-btn" class="error-btn" onclick="window.history.back()">返回</button>
    </div>
  </div>

</div>

<script>
(function() {
  'use strict';

  // ===== 配置 =====
  var CONFIG = {
    shareId: ${JSON.stringify(shareId || '')},
    fileName: ${JSON.stringify(fileName)},
    fileSize: ${fileSize},
    hasExtractCode: ${hasExtractCode},
    expiryTime: ${expiryTime || 0},
    remainingDownloads: ${remainingDownloads !== undefined ? remainingDownloads : -1},
    isFolder: ${!!isFolder},
    userAvatar: ${JSON.stringify(userAvatar)},
    userName: ${JSON.stringify(userName)}
  };

  // ===== DOM 元素 =====
  var verifyPage = document.getElementById('verify-page');
  var downloadPage = document.getElementById('download-page');
  var errorPage = document.getElementById('error-page');
  var extractCodeInput = document.getElementById('extract-code-input');
  var verifyBtn = document.getElementById('verify-btn');
  var verifyError = document.getElementById('verify-error');
  var verifyRateLimit = document.getElementById('verify-rate-limit');
  var downloadBtn = document.getElementById('download-btn');
  var resumeActions = document.getElementById('resume-actions');
  var resumeBtn = document.getElementById('resume-btn');
  var restartBtn = document.getElementById('restart-btn');
  var progressSection = document.getElementById('progress-section');
  var progressBar = document.getElementById('progress-bar');
  var progressPercentage = document.getElementById('progress-percentage');
  var progressSpeed = document.getElementById('progress-speed');
  var progressRemaining = document.getElementById('progress-remaining');
  var downloadSuccess = document.getElementById('download-success');
  var errorTitle = document.getElementById('error-title');
  var errorMessage = document.getElementById('error-message');
  var errorBtn = document.getElementById('error-btn');

  // ===== 下载状态 =====
  var currentXhr = null;
  var isDownloading = false;
  var speedSamples = [];
  var lastLoaded = 0;
  var lastTime = 0;

  // ===== localStorage key =====
  var PROGRESS_KEY = 'neilink_download_' + CONFIG.shareId;

  // ===== 页面初始化 =====
  function init() {
    // 先尝试获取最新分享信息
    fetchShareInfo();
  }

  // ===== 获取分享信息 =====
  function fetchShareInfo() {
    fetch('/api/share-info/' + CONFIG.shareId)
      .then(function(res) {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        return res.json();
      })
      .then(function(data) {
        // 用服务端最新数据更新配置
        if (data.fileName) CONFIG.fileName = data.fileName;
        if (data.fileSize !== undefined) CONFIG.fileSize = data.fileSize;
        if (data.hasExtractCode !== undefined) CONFIG.hasExtractCode = data.hasExtractCode;
        if (data.expiryTime !== undefined) CONFIG.expiryTime = data.expiryTime;
        if (data.remainingDownloads !== undefined) CONFIG.remainingDownloads = data.remainingDownloads;
        if (data.isFolder !== undefined) CONFIG.isFolder = data.isFolder;
        if (data.userAvatar) CONFIG.userAvatar = data.userAvatar;
        if (data.userName) CONFIG.userName = data.userName;

        // 更新页面显示
        var displayName = document.getElementById('display-file-name');
        if (displayName) displayName.textContent = CONFIG.fileName;
        
        // 更新用户头像和名称
        updateUserInfo(data.userAvatar, data.userName, data.uploaderName);

        if (CONFIG.hasExtractCode) {
          showPage('verify');
        } else {
          showPage('download');
          checkResumeDownload();
        }
      })
      .catch(function(err) {
        // 如果API不可用，使用传入的配置
        if (CONFIG.hasExtractCode) {
          showPage('verify');
        } else {
          showPage('download');
          checkResumeDownload();
        }
      });
  }
  
  // ===== 更新用户信息 =====
  function updateUserInfo(userAvatar, userName, uploaderName) {
    var displayName = userName || uploaderName;
    
    // 更新标题
    var headerTitle = document.querySelector('.page-header h1');
    if (headerTitle) headerTitle.textContent = displayName;
    
    // 更新头像
    var header = document.querySelector('.page-header');
    if (header) {
      var currentLogo = header.querySelector('.logo-icon');
      if (userAvatar) {
        // 如果有用户头像，替换为 img 标签
        if (!currentLogo || currentLogo.tagName !== 'IMG') {
          var img = document.createElement('img');
          img.className = 'logo-icon';
          img.alt = '用户头像';
          img.style.borderRadius = '50%';
          img.style.objectFit = 'cover';
          if (currentLogo) currentLogo.replaceWith(img);
          currentLogo = img;
        }
        currentLogo.src = userAvatar;
      } else {
        // 如果没有用户头像，替换为默认 svg
        if (!currentLogo || currentLogo.tagName !== 'svg') {
          var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('class', 'logo-icon');
          svg.setAttribute('viewBox', '0 0 48 48');
          svg.setAttribute('fill', 'none');
          svg.innerHTML = '<circle cx="24" cy="24" r="20" fill="#1890FF" opacity="0.1"/><path d="M24 16c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8zm0 2c-3.314 0-6 2.686-6 6s2.686 6 6 6 6-2.686 6-6-2.686-6-6-6zm0-4c-5.523 0-10 4.477-10 10s4.477 10 10 10 10-4.477 10-10-4.477-10-10-10z" fill="#1890FF" opacity="0.6"/>';
          if (currentLogo) currentLogo.replaceWith(svg);
        }
      }
    }
    
    // 更新文件信息中的上传者名称
    var uploaderElements = document.querySelectorAll('.file-meta-item');
    uploaderElements.forEach(function(el) {
      var label = el.querySelector('.meta-label');
      if (label && label.textContent === '上传者：') {
        var valueSpan = el.querySelector('span:nth-child(2)');
        if (valueSpan) valueSpan.textContent = displayName;
      }
    });
  }

  // ===== 页面切换 =====
  function showPage(page) {
    verifyPage.style.display = 'none';
    downloadPage.style.display = 'none';
    errorPage.style.display = 'none';

    if (page === 'verify') {
      verifyPage.style.display = 'block';
    } else if (page === 'download') {
      downloadPage.style.display = 'block';
    } else if (page === 'error') {
      errorPage.style.display = 'block';
    }
  }

  // ===== 显示错误页面 =====
  function showError(title, message, btnText) {
    errorTitle.textContent = title || '出错了';
    errorMessage.textContent = message || '请稍后再试';
    errorBtn.textContent = btnText || '返回';
    showPage('error');
  }

  // ===== 提取码验证 =====
  extractCodeInput.addEventListener('input', function() {
    var val = extractCodeInput.value.trim();
    verifyBtn.disabled = val.length < 4 || val.length > 8;
    // 清除错误状态
    extractCodeInput.classList.remove('error');
    verifyError.textContent = '';
  });

  extractCodeInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !verifyBtn.disabled) {
      verifyExtractCode();
    }
  });

  verifyBtn.addEventListener('click', verifyExtractCode);

  function verifyExtractCode() {
    var code = extractCodeInput.value.trim();
    if (code.length < 4 || code.length > 8) return;

    verifyBtn.disabled = true;
    verifyBtn.textContent = '验证中...';
    verifyError.textContent = '';

    fetch('/api/verify/' + CONFIG.shareId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code })
    })
    .then(function(res) {
      if (!res.ok) {
        return res.json().then(function(data) {
          throw new Error(data.message || data.error || '验证失败');
        }).catch(function(e) {
          if (e.message && e.message !== '验证失败') throw e;
          throw new Error('验证失败');
        });
      }
      return res.json();
    })
    .then(function(data) {
      // 验证成功
      CONFIG.hasExtractCode = false;
      if (data.fileName) CONFIG.fileName = data.fileName;
      if (data.fileSize !== undefined) CONFIG.fileSize = data.fileSize;
      showPage('download');
      checkResumeDownload();
    })
    .catch(function(err) {
      var msg = err.message || '验证失败';
      if (msg.indexOf('频繁') !== -1 || msg.indexOf('rate') !== -1 || msg.indexOf('10分钟') !== -1) {
        // 频繁访问限制
        verifyRateLimit.style.display = 'block';
        extractCodeInput.disabled = true;
        verifyBtn.disabled = true;
        verifyBtn.textContent = '确认验证';
      } else {
        verifyError.textContent = msg;
        extractCodeInput.classList.add('error');
        verifyBtn.disabled = false;
        verifyBtn.textContent = '确认验证';
      }
    });
  }

  // ===== 断点续传检查 =====
  function checkResumeDownload() {
    try {
      var saved = localStorage.getItem(PROGRESS_KEY);
      if (saved) {
        var info = JSON.parse(saved);
        if (info.downloadedBytes > 0 && info.downloadedBytes < CONFIG.fileSize) {
          resumeActions.classList.add('show');
          return;
        }
      }
    } catch (e) {
      // localStorage 不可用或数据损坏
    }
    resumeActions.classList.remove('show');
  }

  // ===== 下载文件 =====
  downloadBtn.addEventListener('click', function() {
    startDownload(0);
  });

  resumeBtn.addEventListener('click', function() {
    try {
      var saved = localStorage.getItem(PROGRESS_KEY);
      if (saved) {
        var info = JSON.parse(saved);
        startDownload(info.downloadedBytes || 0);
      } else {
        startDownload(0);
      }
    } catch (e) {
      startDownload(0);
    }
  });

  restartBtn.addEventListener('click', function() {
    try {
      localStorage.removeItem(PROGRESS_KEY);
    } catch (e) {}
    startDownload(0);
  });

  function startDownload(startByte) {
    if (isDownloading) return;
    isDownloading = true;

    // 更新UI状态
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<span class="loading-spinner"></span> 下载中...';
    resumeActions.classList.remove('show');
    progressSection.classList.add('show');
    downloadSuccess.classList.remove('show');

    // 重置进度
    speedSamples = [];
    lastLoaded = 0;
    lastTime = Date.now();

    var xhr = new XMLHttpRequest();
    currentXhr = xhr;

    xhr.open('GET', '/api/download/' + CONFIG.shareId);
    if (startByte > 0) {
      xhr.setRequestHeader('Range', 'bytes=' + startByte + '-');
    }
    xhr.responseType = 'blob';

    xhr.onprogress = function(event) {
      if (event.lengthComputable) {
        var loaded = startByte + event.loaded;
        var total;
        // Range请求时，event.total 是剩余部分大小
        if (startByte > 0 && xhr.status === 206) {
          total = startByte + event.total;
        } else {
          total = event.total;
        }
        if (total <= 0) total = CONFIG.fileSize;
        updateProgress(loaded, total);

        // 保存进度到 localStorage
        saveProgress(loaded, total);
      }
    };

    xhr.onload = function() {
      isDownloading = false;
      currentXhr = null;

      if (xhr.status === 200 || xhr.status === 206) {
        var blob = xhr.response;
        triggerDownload(blob);

        // 清除进度记录
        clearProgress();

        // 显示成功
        progressSection.classList.remove('show');
        downloadSuccess.classList.add('show');
        downloadBtn.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5M4 16h12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> 下载完成';
      } else if (xhr.status === 416) {
        // Range Not Satisfiable - 文件已完整下载
        clearProgress();
        progressSection.classList.remove('show');
        downloadSuccess.classList.add('show');
        downloadBtn.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5M4 16h12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> 下载完成';
      } else {
        handleDownloadError(xhr.status);
      }
    };

    xhr.onerror = function() {
      isDownloading = false;
      currentXhr = null;
      handleDownloadError(0);
    };

    xhr.onabort = function() {
      isDownloading = false;
      currentXhr = null;
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5M4 16h12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> 下载';
    };

    xhr.send();
  }

  // ===== 触发浏览器下载 =====
  function triggerDownload(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = CONFIG.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // ===== 更新进度显示 =====
  function updateProgress(loaded, total) {
    var percent = total > 0 ? Math.min((loaded / total) * 100, 100) : 0;
    progressBar.style.width = percent.toFixed(1) + '%';
    progressPercentage.textContent = percent.toFixed(1) + '%';

    // 计算下载速度
    var now = Date.now();
    var timeDiff = (now - lastTime) / 1000; // 秒
    if (timeDiff > 0.1) {
      var bytesDiff = loaded - lastLoaded;
      var speed = bytesDiff / timeDiff; // bytes/s
      speedSamples.push({ speed: speed, time: now });
      // 只保留最近5秒的采样
      var cutoff = now - 5000;
      speedSamples = speedSamples.filter(function(s) { return s.time >= cutoff; });

      if (speedSamples.length > 0) {
        var avgSpeed = 0;
        for (var i = 0; i < speedSamples.length; i++) {
          avgSpeed += speedSamples[i].speed;
        }
        avgSpeed = avgSpeed / speedSamples.length;
        progressSpeed.textContent = formatSpeed(avgSpeed);

        // 计算剩余时间
        var remaining = total - loaded;
        if (avgSpeed > 0) {
          var remainSec = remaining / avgSpeed;
          progressRemaining.textContent = '剩余 ' + formatTime(remainSec);
        }
      }

      lastLoaded = loaded;
      lastTime = now;
    }
  }

  // ===== 下载错误处理 =====
  function handleDownloadError(status) {
    downloadBtn.disabled = false;
    downloadBtn.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5M4 16h12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> 重新下载';

    var title = '下载失败';
    var message = '请稍后再试';

    if (status === 404) {
      title = '文件不存在';
      message = '该分享链接对应的文件已被删除或不存在';
    } else if (status === 410) {
      title = '分享已过期';
      message = '该分享链接已过期，请联系分享者重新分享';
    } else if (status === 403) {
      title = '无下载权限';
      message = '请先验证提取码或联系分享者获取权限';
    } else if (status === 429) {
      title = '操作频繁';
      message = '下载请求过于频繁，请稍后再试';
    } else if (status === 0) {
      title = '网络错误';
      message = '无法连接到服务器，请检查网络连接后重试';
    }

    showError(title, message, '返回');
  }

  // ===== localStorage 进度管理 =====
  function saveProgress(downloaded, total) {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({
        downloadedBytes: downloaded,
        totalBytes: total,
        fileName: CONFIG.fileName,
        timestamp: Date.now()
      }));
    } catch (e) {
      // localStorage 不可用
    }
  }

  function clearProgress() {
    try {
      localStorage.removeItem(PROGRESS_KEY);
    } catch (e) {}
  }

  // ===== 工具函数 =====
  function formatSpeed(bytesPerSec) {
    if (bytesPerSec < 1024) return bytesPerSec.toFixed(0) + ' B/s';
    if (bytesPerSec < 1024 * 1024) return (bytesPerSec / 1024).toFixed(1) + ' KB/s';
    if (bytesPerSec < 1024 * 1024 * 1024) return (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s';
    return (bytesPerSec / (1024 * 1024 * 1024)).toFixed(2) + ' GB/s';
  }

  function formatTime(seconds) {
    if (seconds < 60) return Math.ceil(seconds) + '秒';
    if (seconds < 3600) return Math.floor(seconds / 60) + '分' + Math.ceil(seconds % 60) + '秒';
    var hours = Math.floor(seconds / 3600);
    var mins = Math.floor((seconds % 3600) / 60);
    return hours + '小时' + mins + '分';
  }

  // ===== 启动 =====
  init();

})();
</script>
</body>
</html>`;
}

/**
 * 生成错误页面 HTML
 * @param statusCode HTTP 状态码
 * @param title 错误标题
 * @param message 错误描述
 * @param showBackButton 是否显示返回按钮
 */
export function generateErrorHTML(
  statusCode: number,
  title: string,
  message: string,
  showBackButton: boolean = true
): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="icon" type="image/x-icon" href="/NeiLink.ico">
<link rel="shortcut icon" type="image/x-icon" href="/NeiLink.ico">
<title>${escapeHtml(title)} - NeiLink</title>
<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
      'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    background: #F0F2F5;
    color: #333;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px 16px;
  }

  .container {
    width: 100%;
    max-width: 480px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    overflow: hidden;
  }

  .page-header {
    background: linear-gradient(135deg, #FFF1F0 0%, #FFCCC7 100%);
    padding: 40px 24px 32px;
    text-align: center;
  }

  .error-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #FFF1F0;
    border-radius: 50%;
  }

  .error-code {
    font-size: 14px;
    color: #FF7875;
    font-weight: 500;
    margin-bottom: 4px;
  }

  .error-title {
    font-size: 20px;
    font-weight: 600;
    color: #CF1322;
    margin-bottom: 8px;
  }

  .page-body {
    padding: 32px 24px;
    text-align: center;
  }

  .error-message {
    font-size: 15px;
    color: #666;
    line-height: 1.6;
    margin-bottom: 28px;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .btn-primary {
    width: 100%;
    height: 48px;
    background: linear-gradient(135deg, #1890FF 0%, #096DD9 100%);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.3s;
    box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-secondary {
    width: 100%;
    height: 44px;
    background: #fff;
    color: #666;
    border: 1px solid #D9D9D9;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: border-color 0.3s, color 0.3s;
  }

  .btn-secondary:hover {
    border-color: #1890FF;
    color: #1890FF;
  }

  .tips-section {
    margin-top: 24px;
    border-top: 1px solid #F0F0F0;
    padding-top: 16px;
    text-align: left;
  }

  .tip-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    color: #999;
    margin-bottom: 8px;
    line-height: 1.5;
  }

  .tip-item:last-child {
    margin-bottom: 0;
  }

  .tip-icon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    margin-top: 1px;
  }

  @media (max-width: 768px) {
    body {
      padding: 0;
      align-items: stretch;
    }

    .container {
      max-width: 100%;
      border-radius: 0;
      box-shadow: none;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .page-header {
      padding: 32px 16px 24px;
    }

    .page-body {
      padding: 24px 16px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .btn-primary {
      height: 44px;
      font-size: 15px;
    }
  }
</style>
</head>
<body>
<div class="container">
  <div class="page-header">
    <div class="error-icon">
      <svg width="40" height="40" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="28" fill="#FFF1F0" stroke="#FF4D4F" stroke-width="2"/>
        <path d="M32 20v14M32 42v0" stroke="#FF4D4F" stroke-width="3" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="error-code">错误 ${statusCode}</div>
    <h1 class="error-title">${escapeHtml(title)}</h1>
  </div>

  <div class="page-body">
    <p class="error-message">${escapeHtml(message)}</p>
    <div class="actions">
      ${showBackButton ? `<button class="btn-secondary" onclick="window.history.back()">返回上一页</button>` : ''}
      <button class="btn-primary" onclick="window.location.href='/'">返回首页</button>
    </div>

    <div class="tips-section">
      <div class="tip-item">
        <svg class="tip-icon" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="#1890FF" stroke-width="1.5" fill="none"/>
          <path d="M8 7v4M8 5v0" stroke="#1890FF" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>请确认文件码是否正确，或联系分享者重新获取链接</span>
      </div>
      <div class="tip-item">
        <svg class="tip-icon" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="#1890FF" stroke-width="1.5" fill="none"/>
          <path d="M8 7v4M8 5v0" stroke="#1890FF" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>分享可能已被取消或已过期，请联系分享者重新分享</span>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

export function sendErrorPage(res: ServerResponse, statusCode: number, title: string, message: string, showBackButton?: boolean): void {
  const html = generateErrorHTML(statusCode, title, message, showBackButton);
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(html);
}

/**
 * HTML 转义
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 生成文件码输入页面
 */
export function generateFileCodeInputHTML(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="icon" type="image/x-icon" href="/NeiLink.ico">
<link rel="shortcut icon" type="image/x-icon" href="/NeiLink.ico">
<title>NeiLink - 文件分享</title>
<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
      'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    background: #F0F2F5;
    color: #333;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px 16px;
  }

  .container {
    width: 100%;
    max-width: 480px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    overflow: hidden;
  }

  .page-header {
    background: linear-gradient(135deg, #E6F7FF 0%, #BAE7FF 100%);
    padding: 40px 24px 32px;
    text-align: center;
  }

  .logo-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 16px;
  }

  .page-header h1 {
    font-size: 24px;
    font-weight: 600;
    color: #1890FF;
    margin-bottom: 8px;
  }

  .page-header .subtitle {
    font-size: 14px;
    color: #666;
  }

  .page-body {
    padding: 32px 24px;
  }

  .input-section {
    text-align: center;
  }

  .input-wrapper {
    position: relative;
    margin-bottom: 24px;
  }

  .file-code-input {
    width: 100%;
    height: 56px;
    border: 2px solid #D9D9D9;
    border-radius: 8px;
    padding: 0 20px;
    font-size: 18px;
    text-align: center;
    letter-spacing: 2px;
    outline: none;
    transition: border-color 0.3s;
  }

  .file-code-input:focus {
    border-color: #1890FF;
  }

  .file-code-input.error {
    border-color: #F5222D;
  }

  .file-code-input:disabled {
    background: #F5F5F5;
    color: #BFBFBF;
    cursor: not-allowed;
  }

  .input-hint {
    font-size: 13px;
    color: #999;
    margin-top: 8px;
  }

  .error-message {
    color: #F5222D;
    font-size: 14px;
    margin-top: 12px;
    min-height: 20px;
    transition: opacity 0.3s;
  }

  .submit-btn {
    width: 100%;
    height: 52px;
    background: linear-gradient(135deg, #1890FF 0%, #096DD9 100%);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.3s, opacity 0.3s;
    box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
  }

  .submit-btn:hover {
    opacity: 0.9;
  }

  .submit-btn:active {
    transform: scale(0.98);
  }

  .submit-btn:disabled {
    background: #D9D9D9;
    box-shadow: none;
    cursor: not-allowed;
  }

  .tips-section {
    margin-top: 24px;
    border-top: 1px solid #F0F0F0;
    padding-top: 16px;
  }

  .tip-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    color: #999;
    margin-bottom: 8px;
    line-height: 1.5;
  }

  .tip-icon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    margin-top: 1px;
  }

  @media (max-width: 768px) {
    body {
      padding: 0;
      align-items: stretch;
    }

    .container {
      max-width: 100%;
      border-radius: 0;
      box-shadow: none;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .page-header {
      padding: 32px 16px 24px;
    }

    .page-header h1 {
      font-size: 20px;
    }

    .page-body {
      padding: 24px 16px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .file-code-input {
      height: 52px;
      font-size: 16px;
    }

    .submit-btn {
      height: 48px;
      font-size: 16px;
    }
  }
</style>
</head>
<body>
<div class="container">
  <div class="page-header">
    <svg class="logo-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="28" fill="#1890FF" opacity="0.1"/>
      <path d="M32 16v32M16 32h32" stroke="#1890FF" stroke-width="3" stroke-linecap="round"/>
      <circle cx="32" cy="32" r="28" stroke="#1890FF" stroke-width="2" fill="none"/>
    </svg>
    <h1>NeiLink</h1>
    <p class="subtitle">安全文件传输</p>
  </div>

  <div class="page-body">
    <div class="input-section">
      <div class="input-wrapper">
        <input
          type="text"
          id="file-code-input"
          class="file-code-input"
          placeholder="请输入文件码"
          maxlength="36"
          autocomplete="off"
        />
      </div>
      <p class="input-hint">文件码是分享链接中的唯一标识</p>
      <div id="error-message" class="error-message"></div>
      <button id="submit-btn" class="submit-btn" disabled>进入下载</button>
    </div>

    <div class="tips-section">
      <div class="tip-item">
        <svg class="tip-icon" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="#1890FF" stroke-width="1.5" fill="none"/>
          <path d="M8 7v4M8 5v0" stroke="#1890FF" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>文件码由分享者提供，通常在分享链接中</span>
      </div>
      <div class="tip-item">
        <svg class="tip-icon" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="#1890FF" stroke-width="1.5" fill="none"/>
          <path d="M8 7v4M8 5v0" stroke="#1890FF" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>输入正确的文件码即可访问对应的文件</span>
      </div>
    </div>
  </div>
</div>

<script>
(function() {
  'use strict';

  var fileCodeInput = document.getElementById('file-code-input');
  var submitBtn = document.getElementById('submit-btn');
  var errorMessage = document.getElementById('error-message');

  fileCodeInput.addEventListener('input', function() {
    var val = fileCodeInput.value.trim();
    submitBtn.disabled = val.length < 1;
    fileCodeInput.classList.remove('error');
    errorMessage.textContent = '';
  });

  fileCodeInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !submitBtn.disabled) {
      submitFileCode();
    }
  });

  submitBtn.addEventListener('click', submitFileCode);

  function submitFileCode() {
    var fileCode = fileCodeInput.value.trim();
    if (!fileCode) return;

    // 跳转到文件码路径
    window.location.href = '/' + fileCode;
  }

})();
</script>
</body>
</html>`;
}

/**
 * 格式化过期时间
 */
function formatExpiryTime(expiryTime: number): string {
  const now = Date.now();
  const diff = expiryTime - now;

  if (diff <= 0) return '已过期';

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days > 0) return days + '天';
  if (hours > 0) return hours + '小时';
  if (minutes > 0) return minutes + '分钟';
  return '即将过期';
}
