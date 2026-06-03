/**
 * 热点管理模块
 * Windows 10/11: 优先使用 PowerShell + WinRT NetworkOperatorTetheringManager
 *                 回退使用 netsh wlan hostednetwork
 * macOS: 预留接口
 * Linux: 使用 nmcli
 */

import { exec } from 'child_process';
import * as os from 'os';
import * as crypto from 'crypto';
import { Logger } from './logger';

export interface HotspotConfig {
  ssid: string;
  password: string;
  randomPassword?: boolean;
}

export interface HotspotStatus {
  enabled: boolean;
  ssid?: string;
  password?: string;
  error?: string;
  clients?: number;
}

// ==================== 常量 ====================

const DEFAULT_SSID = 'NeiLink';
const NMCLI_CONNECTION_NAME = 'Hotspot';
const PS_OK = 'OK';
const PS_OFF = 'OFF';
const PS_TRUE = 'TRUE';
const PS_FALSE = 'FALSE';
const PS_ON_PREFIX = 'ON:';
const PS_ERROR_PREFIX = 'ERROR:';
const PS_STATUS_DELIMITER = '\x1E';

let loggerRef: Logger | undefined = undefined;
let currentConfig: HotspotConfig | undefined = undefined;

const PLATFORM = os.platform();

function execCmd(command: string, timeout = 15000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, { timeout, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function runPowerShell(script: string, timeout = 60000): Promise<string> {
  const utf8Script = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n${script}`;
  const encoded = Buffer.from(utf8Script, 'utf16le').toString('base64');
  return execCmd(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, timeout)
    .then(({ stdout }) => stdout.trim());
}

/**
 * 对插入到 PowerShell 单引号字面量中的字符串进行安全转义
 * 第一层: 转义 JS 模板字面量特殊字符 (\ ` ${)
 * 第二层: 转义 PS 单引号字符串特殊字符 (')
 */
function escapePSLiteral(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
    .replace(/'/g, "''");
}

export function initializeHotspot(logger: Logger): void {
  loggerRef = logger;
}

function generatePassword(length: number): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

function translateWinError(raw: string): string {
  if (raw.startsWith('CONFIG:'))
    return `热点配置失败: ${raw.substring(7)}`;
  if (raw.startsWith('START:'))
    return `热点启动失败: ${raw.substring(6)}`;
  if (raw.includes('NO_MANAGER'))
    return '无法创建热点管理器，请检查 Wi-Fi 是否开启';
  if (raw.includes('NO_CONFIG'))
    return '无法获取热点配置，请检查 Wi-Fi 是否开启';
  if (raw.includes('START_FAILED'))
    return '热点启动失败，请检查 Wi-Fi 是否开启后重试';
  if (raw.includes('STOP_FAILED'))
    return '热点停止失败，请重试';
  if (raw.includes('BUSY'))
    return '热点正被其他程序占用，请先关闭所有热点再重试';
  if (raw.includes('NO_INTERNET')) return '没有可用的互联网连接，无法启动热点';
  if (raw.includes('TIMEOUT')) return '热点操作超时，请重试';
  if (raw.includes('denied') || raw.includes('拒绝') || raw.includes('elevation') || raw.includes('Administrator'))
    return '需要管理员权限，请以管理员身份运行 NeiLink';
  if (raw.includes('not supported') || raw.includes('不支持'))
    return '无线网卡不支持热点功能，或 Wi-Fi 未开启';
  if (raw.includes('already') || raw.includes('已启动')) return '热点已在运行中';
  if (raw.includes('EXCEPTION:')) {
    const msg = raw.replace('EXCEPTION:', '');
    if (msg.includes('denied') || msg.includes('权限') || msg.includes('Unauthorized'))
      return '需要管理员权限，请以管理员身份运行 NeiLink';
    if (msg.includes('Null') || msg.includes('null') || msg.includes('空值'))
      return '热点操作内部错误，请检查 Wi-Fi 是否开启后重试';
    return `热点操作失败: ${msg}`;
  }
  return raw || '热点操作失败，请尝试以管理员身份运行应用';
}

// ==================== Windows PowerShell + WinRT ====================

const PS_LOAD_WINRT = `
[Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime] | Out-Null
[Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime] | Out-Null
`;

async function winStartHotspotPS(ssid: string, password: string): Promise<HotspotStatus> {
  const safeSsid = escapePSLiteral(ssid);
  const safePass = escapePSLiteral(password);

  const script = `${PS_LOAD_WINRT}
function Get-TetheringState {
  param($mgr)
  try {
    $s = $mgr.TetheringOperationalState
    if ($null -ne $s) { return $s.ToString() }
  } catch {}
  return $null
}

function Wait-ForState {
  param($mgr, [string]$target, [int]$timeoutSec = 30)
  $t = Get-Date
  while ($true) {
    Start-Sleep -Seconds 1
    $s = Get-TetheringState $mgr
    if ($s -eq $target) { return $true }
    if (((Get-Date) - $t).TotalSeconds -gt $timeoutSec) { return $false }
  }
}

try {
  $profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
  if ($null -eq $profile) {
    Write-Output '${PS_ERROR_PREFIX}NO_INTERNET'
    exit 0
  }
  $manager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($profile)
  if ($null -eq $manager) {
    Write-Output '${PS_ERROR_PREFIX}NO_MANAGER'
    exit 0
  }

  $curState = Get-TetheringState $manager
  if ($curState -eq 'On') {
    try {
      $cur = $manager.GetCurrentAccessPointConfiguration()
      if ($null -ne $cur -and $cur.Ssid -eq '${safeSsid}') {
        Write-Output '${PS_OK}'
        exit 0
      }
    } catch {}
    $manager.StopTetheringAsync() | Out-Null
    if (-not (Wait-ForState $manager 'Off' 15)) {
      Write-Output '${PS_ERROR_PREFIX}BUSY'
      exit 0
    }
  }

  try {
    $config = $manager.GetCurrentAccessPointConfiguration()
    if ($null -ne $config) {
      $config.Ssid = '${safeSsid}'
      $config.Passphrase = '${safePass}'
      $manager.ConfigureAccessPointAsync($config) | Out-Null
      Start-Sleep -Seconds 2
    }
  } catch {}

  $manager.StartTetheringAsync() | Out-Null

  if (Wait-ForState $manager 'On' 30) {
    Write-Output '${PS_OK}'
  } else {
    Write-Output '${PS_ERROR_PREFIX}START_FAILED'
  }
} catch {
  Write-Output "${PS_ERROR_PREFIX}EXCEPTION:$($_.Exception.Message)"
}`;

  const output = await runPowerShell(script);

  if (output === PS_OK) {
    currentConfig = { ssid, password };
    return { enabled: true, ssid, password };
  }

  if (output.startsWith(PS_ERROR_PREFIX)) {
    throw new Error(output.substring(PS_ERROR_PREFIX.length));
  }

  throw new Error(output || '未知错误');
}

async function winStopHotspotPS(): Promise<HotspotStatus> {
  const script = `${PS_LOAD_WINRT}
function Get-TetheringState {
  param($mgr)
  try {
    $s = $mgr.TetheringOperationalState
    if ($null -ne $s) { return $s.ToString() }
  } catch {}
  return $null
}

function Wait-ForStateNot {
  param($mgr, [string]$exclude, [int]$timeoutSec = 15)
  $t = Get-Date
  while ($true) {
    Start-Sleep -Seconds 1
    $s = Get-TetheringState $mgr
    if ($s -ne $exclude) { return $true }
    if (((Get-Date) - $t).TotalSeconds -gt $timeoutSec) { return $false }
  }
}

try {
  $profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
  if ($null -eq $profile) {
    Write-Output '${PS_OK}'
    exit 0
  }
  $manager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($profile)
  if ($null -eq $manager) {
    Write-Output '${PS_OK}'
    exit 0
  }
  $manager.StopTetheringAsync() | Out-Null

  if (Wait-ForStateNot $manager 'On' 15) {
    Write-Output '${PS_OK}'
  } else {
    Write-Output '${PS_ERROR_PREFIX}STOP_FAILED'
  }
} catch {
  Write-Output "${PS_ERROR_PREFIX}EXCEPTION:$($_.Exception.Message)"
}`;

  const output = await runPowerShell(script);

  if (output === PS_OK) {
    return { enabled: false };
  }

  if (output.startsWith(PS_ERROR_PREFIX)) {
    throw new Error(output.substring(PS_ERROR_PREFIX.length));
  }

  throw new Error(output || '未知错误');
}

async function winGetHotspotStatusPS(): Promise<HotspotStatus> {
  const script = `${PS_LOAD_WINRT}
function Get-TetheringState {
  param($mgr)
  try {
    $s = $mgr.TetheringOperationalState
    if ($null -ne $s) { return $s.ToString() }
  } catch {}
  return $null
}

try {
  $profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
  if ($null -eq $profile) {
    Write-Output '${PS_OFF}'
    exit 0
  }
  $manager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($profile)
  if ($null -eq $manager) {
    Write-Output '${PS_OFF}'
    exit 0
  }
  $state = Get-TetheringState $manager
  if ($state -eq 'On') {
    try {
      $config = $manager.GetCurrentAccessPointConfiguration()
      if ($null -ne $config) {
        Write-Output "${PS_ON_PREFIX}$($config.Ssid)$([char]${PS_STATUS_DELIMITER.charCodeAt(0)})$($config.Passphrase)"
      } else {
        Write-Output "${PS_ON_PREFIX}${PS_STATUS_DELIMITER}"
      }
    } catch {
      Write-Output "${PS_ON_PREFIX}${PS_STATUS_DELIMITER}"
    }
  } else {
    Write-Output '${PS_OFF}'
  }
} catch {
  Write-Output '${PS_OFF}'
}`;

  try {
    const output = await runPowerShell(script);

    if (output.startsWith(PS_ON_PREFIX)) {
      const payload = output.substring(PS_ON_PREFIX.length);
      const delimIndex = payload.indexOf(PS_STATUS_DELIMITER);
      if (delimIndex !== -1) {
        return {
          enabled: true,
          ssid: payload.substring(0, delimIndex) || currentConfig?.ssid,
          password: payload.substring(delimIndex + 1) || currentConfig?.password,
        };
      }
      return {
        enabled: true,
        ssid: payload || currentConfig?.ssid,
        password: currentConfig?.password,
      };
    }

    return { enabled: false, ssid: currentConfig?.ssid, password: currentConfig?.password };
  } catch {
    return { enabled: false, ssid: currentConfig?.ssid, password: currentConfig?.password };
  }
}

// ==================== Windows netsh 回退 ====================

async function winStartHotspotNetsh(ssid: string, password: string): Promise<HotspotStatus> {
  await execCmd(`netsh wlan set hostednetwork mode=allow ssid="${ssid}" key="${password}"`);
  await execCmd('netsh wlan start hostednetwork');
  currentConfig = { ssid, password };
  return { enabled: true, ssid, password };
}

async function winStopHotspotNetsh(): Promise<HotspotStatus> {
  await execCmd('netsh wlan stop hostednetwork');
  return { enabled: false };
}

async function winGetHotspotStatusNetsh(): Promise<HotspotStatus> {
  try {
    const { stdout } = await execCmd('netsh wlan show hostednetwork');
    const isRunning = (stdout.includes('状态') && stdout.includes('已启动'))
      || (stdout.includes('Status') && stdout.includes('Started'));
    if (isRunning) {
      const ssidMatch = stdout.match(/SSID\s*:\s*(.+)/i);
      const ssid = ssidMatch ? ssidMatch[1].trim() : currentConfig?.ssid;
      const clientsMatch = stdout.match(/已连接的客户数\s*:\s*(\d+)/i)
        || stdout.match(/Number of clients\s*:\s*(\d+)/i);
      const clients = clientsMatch ? parseInt(clientsMatch[1], 10) : 0;
      return {
        enabled: true,
        ssid: ssid || currentConfig?.ssid,
        password: currentConfig?.password,
        clients,
      };
    }
    return { enabled: false, ssid: currentConfig?.ssid, password: currentConfig?.password };
  } catch {
    return { enabled: false, ssid: currentConfig?.ssid, password: currentConfig?.password };
  }
}

// ==================== Windows 统一接口（PS 优先 + netsh 回退） ====================

async function windowsStartHotspot(config?: HotspotConfig): Promise<HotspotStatus> {
  const ssid = config?.ssid || currentConfig?.ssid || DEFAULT_SSID;
  const useRandom = config?.randomPassword ?? currentConfig?.randomPassword ?? true;
  const password = useRandom
    ? generatePassword(8)
    : (config?.password || currentConfig?.password || generatePassword(8));

  try {
    const result = await winStartHotspotPS(ssid, password);
    if (loggerRef) {
      loggerRef.log('system', `热点已启动: ${ssid}`, {
        messageKey: 'hotspot.started',
        messageParams: [ssid]
      });
    }
    return result;
  } catch (psErr) {
    const psMessage = psErr instanceof Error ? psErr.message : String(psErr);

    let status = await winGetHotspotStatusPS();
    if (status.enabled) {
      if (loggerRef) {
        loggerRef.log('system', `热点已启动(延迟确认): ${ssid}`, {
          messageKey: 'hotspot.started',
          messageParams: [ssid]
        });
      }
      currentConfig = { ssid, password };
      return { enabled: true, ssid, password };
    }

    status = await winGetHotspotStatusNetsh();
    if (status.enabled) {
      if (loggerRef) {
        loggerRef.log('system', `热点已启动(netsh确认): ${ssid}`, {
          messageKey: 'hotspot.started',
          messageParams: [ssid]
        });
      }
      currentConfig = { ssid, password };
      return { enabled: true, ssid, password };
    }

    if (loggerRef) {
      loggerRef.log('system', 'PowerShell 热点启动失败，尝试 netsh 方式', {
        detail: psMessage,
      });
    }

    try {
      const result = await winStartHotspotNetsh(ssid, password);
      if (loggerRef) {
        loggerRef.log('system', `热点已启动(netsh): ${ssid}`, {
          messageKey: 'hotspot.started',
          messageParams: [ssid]
        });
      }
      return result;
    } catch (netshErr) {
      const netshMessage = netshErr instanceof Error ? netshErr.message : String(netshErr);
      const errorMessage = translateWinError(psMessage);

      if (loggerRef) {
        loggerRef.log('error', `热点启动失败: ${errorMessage}`, {
          detail: `PS: ${psMessage}; Netsh: ${netshMessage}`,
          messageKey: 'hotspot.startFailed',
          messageParams: [errorMessage]
        });
      }

      return { enabled: false, error: errorMessage };
    }
  }
}

async function windowsStopHotspot(): Promise<HotspotStatus> {
  const configSsid = currentConfig?.ssid;

  try {
    const result = await winStopHotspotPS();
    if (loggerRef) {
      loggerRef.log('system', `热点已停止: ${configSsid || '未知'}`, {
        messageKey: 'hotspot.stopped',
        messageParams: [configSsid || '未知']
      });
    }
    return result;
  } catch (psErr) {
    const psMessage = psErr instanceof Error ? psErr.message : String(psErr);

    let status = await winGetHotspotStatusPS();
    if (!status.enabled) {
      if (loggerRef) {
        loggerRef.log('system', `热点已停止(延迟确认): ${configSsid || '未知'}`, {
          messageKey: 'hotspot.stopped',
          messageParams: [configSsid || '未知']
        });
      }
      return { enabled: false };
    }

    status = await winGetHotspotStatusNetsh();
    if (!status.enabled) {
      if (loggerRef) {
        loggerRef.log('system', `热点已停止(netsh确认): ${configSsid || '未知'}`, {
          messageKey: 'hotspot.stopped',
          messageParams: [configSsid || '未知']
        });
      }
      return { enabled: false };
    }

    try {
      const result = await winStopHotspotNetsh();
      if (loggerRef) {
        loggerRef.log('system', `热点已停止(netsh): ${configSsid || '未知'}`, {
          messageKey: 'hotspot.stopped',
          messageParams: [configSsid || '未知']
        });
      }
      return result;
    } catch (netshErr) {
      const netshMessage = netshErr instanceof Error ? netshErr.message : String(netshErr);
      const errorMessage = translateWinError(psMessage);

      if (loggerRef) {
        loggerRef.log('error', `热点停止失败: ${errorMessage}`, {
          detail: errorMessage,
          messageKey: 'hotspot.stopFailed',
          messageParams: [errorMessage]
        });
      }

      return { enabled: false, error: errorMessage };
    }
  }
}

async function windowsGetHotspotStatus(): Promise<HotspotStatus> {
  try {
    return await winGetHotspotStatusPS();
  } catch {
    return winGetHotspotStatusNetsh();
  }
}

async function windowsCheckSupport(): Promise<boolean> {
  try {
    const script = `${PS_LOAD_WINRT}
try {
  $profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
  if ($null -eq $profile) {
    Write-Output '${PS_FALSE}'
    exit 0
  }
  $manager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($profile)
  Write-Output '${PS_TRUE}'
} catch {
  Write-Output '${PS_FALSE}'
}`;
    const output = await runPowerShell(script);
    return output === PS_TRUE;
  } catch {
    try {
      const { stdout } = await execCmd('netsh wlan show drivers');
      return stdout.includes('Hosted network');
    } catch {
      return false;
    }
  }
}

async function windowsConfigureHotspot(config: HotspotConfig): Promise<void> {
  currentConfig = { ssid: config.ssid, password: config.password, randomPassword: config.randomPassword };

  if (loggerRef) {
    loggerRef.log('system', `热点配置已更新: ${config.ssid}`, {
      messageKey: 'hotspot.configured',
      messageParams: [config.ssid]
    });
  }
}

// ==================== macOS 实现 ====================

async function macStartHotspot(_config?: HotspotConfig): Promise<HotspotStatus> {
  return {
    enabled: false,
    error: 'macOS 热点功能暂未支持，请使用系统设置中的"互联网共享"',
  };
}

async function macStopHotspot(): Promise<HotspotStatus> {
  return {
    enabled: false,
    error: 'macOS 热点功能暂未支持',
  };
}

async function macGetHotspotStatus(): Promise<HotspotStatus> {
  return { enabled: false, ssid: currentConfig?.ssid, password: currentConfig?.password };
}

async function macConfigureHotspot(config: HotspotConfig): Promise<void> {
  currentConfig = { ssid: config.ssid, password: config.password, randomPassword: config.randomPassword };
}

// ==================== Linux 实现 ====================

async function linuxStartHotspot(config?: HotspotConfig): Promise<HotspotStatus> {
  const ssid = config?.ssid || currentConfig?.ssid || DEFAULT_SSID;
  const useRandom = config?.randomPassword ?? currentConfig?.randomPassword ?? true;
  const password = useRandom
    ? generatePassword(8)
    : (config?.password || currentConfig?.password || generatePassword(8));

  try {
    await execCmd(`nmcli device wifi hotspot ssid "${ssid}" password "${password}"`);
    currentConfig = { ssid, password };

    if (loggerRef) {
      loggerRef.log('system', `热点已启动: ${ssid}`, {
        messageKey: 'hotspot.started',
        messageParams: [ssid]
      });
    }

    return { enabled: true, ssid, password };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (loggerRef) {
      loggerRef.log('error', `热点启动失败: ${message}`, {
        detail: message,
        messageKey: 'hotspot.startFailed',
        messageParams: [message]
      });
    }

    return { enabled: false, error: message };
  }
}

async function linuxStopHotspot(): Promise<HotspotStatus> {
  try {
    await execCmd(`nmcli connection down ${NMCLI_CONNECTION_NAME}`);
    const ssid = currentConfig?.ssid;

    if (loggerRef) {
      loggerRef.log('system', `热点已停止: ${ssid || '未知'}`, {
        messageKey: 'hotspot.stopped',
        messageParams: [ssid || '未知']
      });
    }

    return { enabled: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { enabled: false, error: message };
  }
}

async function linuxGetHotspotStatus(): Promise<HotspotStatus> {
  try {
    const { stdout } = await execCmd('nmcli -t -f NAME,DEVICE connection show --active');
    const isHotspot = stdout.split('\n').some(line => line.includes(NMCLI_CONNECTION_NAME));

    if (isHotspot) {
      return {
        enabled: true,
        ssid: currentConfig?.ssid,
        password: currentConfig?.password,
      };
    }

    return { enabled: false, ssid: currentConfig?.ssid, password: currentConfig?.password };
  } catch {
    return { enabled: false, ssid: currentConfig?.ssid, password: currentConfig?.password };
  }
}

async function linuxConfigureHotspot(config: HotspotConfig): Promise<void> {
  currentConfig = { ssid: config.ssid, password: config.password, randomPassword: config.randomPassword };

  if (loggerRef) {
    loggerRef.log('system', `热点配置已更新: ${config.ssid}`, {
      messageKey: 'hotspot.configured',
      messageParams: [config.ssid]
    });
  }
}

// ==================== 统一接口 ====================

export async function startHotspot(config?: HotspotConfig): Promise<HotspotStatus> {
  switch (PLATFORM) {
    case 'win32':
      return windowsStartHotspot(config);
    case 'darwin':
      return macStartHotspot(config);
    case 'linux':
      return linuxStartHotspot(config);
    default:
      return { enabled: false, error: `不支持的平台: ${PLATFORM}` };
  }
}

export async function stopHotspot(): Promise<HotspotStatus> {
  switch (PLATFORM) {
    case 'win32':
      return windowsStopHotspot();
    case 'darwin':
      return macStopHotspot();
    case 'linux':
      return linuxStopHotspot();
    default:
      return { enabled: false, error: `不支持的平台: ${PLATFORM}` };
  }
}

export async function getHotspotStatus(): Promise<HotspotStatus> {
  switch (PLATFORM) {
    case 'win32':
      return windowsGetHotspotStatus();
    case 'darwin':
      return macGetHotspotStatus();
    case 'linux':
      return linuxGetHotspotStatus();
    default:
      return { enabled: false };
  }
}

export async function configureHotspot(config: HotspotConfig): Promise<void> {
  switch (PLATFORM) {
    case 'win32':
      return windowsConfigureHotspot(config);
    case 'darwin':
      return macConfigureHotspot(config);
    case 'linux':
      return linuxConfigureHotspot(config);
    default:
      return;
  }
}

export async function isHotspotAvailable(): Promise<boolean> {
  switch (PLATFORM) {
    case 'win32':
      return windowsCheckSupport();
    case 'darwin':
      return false;
    case 'linux':
      try {
        await execCmd('which nmcli');
        return true;
      } catch {
        return false;
      }
    default:
      return false;
  }
}
