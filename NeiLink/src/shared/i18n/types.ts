// 语言包类型定义
export interface Locale {
  // 通用
  common: {
    save: string;
    cancel: string;
    confirm: string;
    ok: string;
    close: string;
    delete: string;
    edit: string;
    copy: string;
    refresh: string;
    back: string;
    next: string;
    retry: string;
    search: string;
    batchDelete: string;
    action: string;
    copied: string;
    none: string;
    unlimited: string;
  };
  
  // 页面标题
  pages: {
    home: string;
    shareManage: string;
    settings: string;
    log: string;
  };
  
  // 主页面
  home: {
    title: string;
    dragText: string;
    dragHint: string;
    dropHint: string;
    selectFile: string;
    selectFolder: string;
    shareButton: string;
    recentShares: string;
    noShares: string;
    shareLink: string;
    copyLink: string;
    extractCode: string;
  };
  
  // 分享配置
  shareConfig: {
    title: string;
    shareSuccess: string;
    fileName: string;
    extractCode: string;
    extractCodeSetting: string;
    extractCodePlaceholder: string;
    extractCodeHint: string;
    enterExtractCode: string;
    extractCodeLength: string;
    extractCodeFormat: string;
    expiry: string;
    maxDownloads: string;
    maxConcurrentDownloads: string;
    confirmShare: string;
    copyShareInfo: string;
    hotspotInfo: string;
    hotspotName: string;
    hotspotPassword: string;
    permanent: string;
    unlimited: string;
    shareLink: string;
    hour: string;
    day: string;
  };
  
  // 分享管理
  shareManage: {
    title: string;
    status: string;
    fileName: string;
    shareInfo: string;
    shareLink: string;
    extractCode: string;
    expiry: string;
    remainingDownloads: string;
    maxConcurrentDownloads: string;
    uploader: string;
    createdAt: string;
    actions: string;
    copyLink: string;
    editConfig: string;
    cancelShare: string;
    noShares: string;
    shareExpired: string;
    shareCancelled: string;
    statusActive: string;
    hour: string;
    minute: string;
    second: string;
    permanent: string;
    totalShares: string;
    share: string;
    perPage: string;
  };
  
  // 编辑分享配置
  editShareConfig: {
    title: string;
    fileName: string;
    extractCode: string;
    extractCodeHint: string;
    expiry: string;
    maxDownloads: string;
    maxConcurrentDownloads: string;
    save: string;
  };
  
  // 设置页面
  settings: {
    title: string;
    general: string;
    network: string;
    security: string;
    logs: string;
    user: string;
    autoStart: string;
    autoStartHint: string;
    defaultExtractCode: string;
    defaultExtractCodeHint: string;
    defaultExpiry: string;
    defaultExpiryHint: string;
    defaultMaxDownloads: string;
    defaultMaxDownloadsHint: string;
    defaultMaxConcurrent: string;
    defaultMaxConcurrentHint: string;
    port: string;
    portHint: string;
    language: string;
    languageHint: string;
    hotspotPrefix: string;
    hotspotPrefixHint: string;
    hotspotPasswordLength: string;
    hotspotPasswordLengthHint: string;
    encryptionBits: string;
    encryptionBitsHint: string;
    rateLimitEnabled: string;
    rateLimitEnabledHint: string;
    rateLimitMaxAttempts: string;
    rateLimitMaxAttemptsHint: string;
    rateLimitBanDuration: string;
    rateLimitBanDurationHint: string;
    logRetentionDays: string;
    logRetentionDaysHint: string;
    logStoragePath: string;
    logStoragePathHint: string;
    clearSharesOnExit: string;
    clearSharesOnExitHint: string;
    selectedAdapter: string;
    selectedAdapterHint: string;
    userName: string;
    userNameHint: string;
    userAvatar: string;
    userAvatarHint: string;
    removeAvatar: string;
    bannedIPManagement: string;
    noBannedIPs: string;
    ipAddress: string;
    attemptsPerMinute: string;
    remainingBanTime: string;
    modifyDuration: string;
    confirmUnban: string;
    unbanDescription: string;
    unban: string;
    hour: string;
    day: string;
    time: string;
    count: string;
    permanent: string;
    unlimited: string;
    changePath: string;
    detectPort: string;
    theme: string;
    themeHint: string;
    themeLight: string;
    themeDark: string;
    themeAuto: string;
  };
  
  // 日志页面
  log: {
    title: string;
    clearLogs: string;
    exportLogs: string;
    logType: string;
    logMessage: string;
    logTime: string;
    logDetail: string;
    noLogs: string;
    today: string;
    yesterday: string;
    last7Days: string;
    last30Days: string;
    custom: string;
    allTypes: string;
    share: string;
    download: string;
    error: string;
    system: string;
    totalLogs: string;
  };
  
  // 热点配置
  hotspot: {
    title: string;
    ssid: string;
    password: string;
    startHotspot: string;
    stopHotspot: string;
    status: string;
    statusRunning: string;
    statusStopped: string;
  };
  
  // 网络相关
  network: {
    connected: string;
    disconnected: string;
    ethernet: string;
    noNetwork: string;
    adapter: string;
    localIP: string;
  };
  
  // 通知
  notification: {
    shareCreated: string;
    shareCancelled: string;
    shareExpired: string;
    downloadComplete: string;
    error: string;
    success: string;
    warning: string;
  };
  
  // 错误信息
  error: {
    shareFailed: string;
    fileNotFound: string;
    invalidExtractCode: string;
    shareExpired: string;
    maxDownloadsReached: string;
    networkError: string;
    portOccupied: string;
  };
  
  // 时间相关
  time: {
    hour: string;
    hours: string;
    day: string;
    days: string;
    permanent: string;
    expired: string;
    remaining: string;
  };
  
  // 数字相关
  number: {
    times: string;
    unlimited: string;
  };
}

// 支持的语言
export type SupportedLanguage = 'zh-CN' | 'en-US';
