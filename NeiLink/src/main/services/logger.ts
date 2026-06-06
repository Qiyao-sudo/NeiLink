/**
 * 日志系统模块
 * 使用 JSON Lines 格式存储日志到文件系统
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import dayjs from 'dayjs';
import { LogEntry } from '../../shared/types';
import { getLocale, translateLogMessage } from '../../shared/i18n';

export class Logger {
  private logFilePath: string;
  private logDir: string;
  private writeQueue: string[] = [];
  private writing: boolean = false;

  /**
   * @param logDir 日志存储目录路径
   */
  constructor(logDir: string) {
    this.logDir = logDir;
    this.logFilePath = path.join(logDir, 'neilink.log');

    // 确保日志目录存在
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // 如果日志文件不存在，创建空文件
    if (!fs.existsSync(this.logFilePath)) {
      fs.writeFileSync(this.logFilePath, '', 'utf-8');
    }
  }

  /**
   * 异步消费写入队列
   */
  private flushQueue(): void {
    if (this.writing || this.writeQueue.length === 0) return;
    this.writing = true;
    const batch = this.writeQueue.splice(0);
    const data = batch.join('');
    fs.appendFile(this.logFilePath, data, 'utf-8', (err) => {
      this.writing = false;
      if (err) {
        console.error('写入日志失败:', err);
      }
      if (this.writeQueue.length > 0) {
        this.flushQueue();
      }
    });
  }

  /**
   * 记录一条日志
   * @param type 日志类型
   * @param message 日志消息
   * @param detail 详细信息（可选）
   */
  log(
    type: LogEntry['type'],
    message: string,
    opts?: {
      detail?: string;
      messageKey?: string;
      messageParams?: string[];
    }
  ): LogEntry {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type,
      message,
      detail: opts?.detail,
      messageKey: opts?.messageKey,
      messageParams: opts?.messageParams,
    };

    // 异步追加写入日志文件（JSON Lines 格式，每行一个 JSON 对象）
    const line = JSON.stringify(entry) + '\n';
    this.writeQueue.push(line);
    this.flushQueue();

    return entry;
  }

  /**
   * 获取日志列表
   * @param filter 过滤条件
   * @param limit 最大返回条数，默认 1000，-1 表示全部
   */
  getLogs(filter?: {
    type?: LogEntry['type'];
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): LogEntry[] {
    try {
      const limit = filter?.limit ?? 1000;
      const content = fs.readFileSync(this.logFilePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim() !== '');

      // 如果只需要最新的 N 条，从末尾开始解析以减少 JSON.parse 次数
      if (limit > 0 && !filter?.type && !filter?.startTime && !filter?.endTime) {
        const result: LogEntry[] = [];
        for (let i = lines.length - 1; i >= 0 && result.length < limit; i--) {
          try {
            result.push(JSON.parse(lines[i]) as LogEntry);
          } catch { /* skip malformed lines */ }
        }
        return result; // 已经是倒序（最新的在前）
      }

      let entries: LogEntry[] = lines.map((line) => {
        try {
          return JSON.parse(line) as LogEntry;
        } catch {
          return null;
        }
      }).filter((entry): entry is LogEntry => entry !== null);

      // 按过滤条件筛选
      if (filter?.type) {
        entries = entries.filter((e) => e.type === filter.type);
      }
      if (filter?.startTime) {
        entries = entries.filter((e) => e.timestamp >= filter.startTime!);
      }
      if (filter?.endTime) {
        entries = entries.filter((e) => e.timestamp <= filter.endTime!);
      }

      // 按时间倒序排列（最新的在前）
      entries.sort((a, b) => b.timestamp - a.timestamp);

      // 应用 limit
      if (limit > 0 && entries.length > limit) {
        entries = entries.slice(0, limit);
      }

      return entries;
    } catch (err) {
      this.log('error', '读取日志文件失败', {
        detail: err instanceof Error ? err.message : String(err),
        messageKey: 'error.readLogFile',
      });
      return [];
    }
  }

  /**
   * 清空所有日志
   */
  clearLogs(): void {
    fs.writeFileSync(this.logFilePath, '', 'utf-8');
  }

  /**
   * 导出日志为文本文件
   * @returns 导出文件的路径
   */
  exportLogs(language?: string): string {
    const entries = this.getLogs();
    const locale = getLocale(language || 'zh-CN');

    const exportDir = path.join(this.logDir, 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
    const exportPath = path.join(exportDir, `neilink_log_${timestamp}.txt`);

    const headerExportTime = language === 'en-US' ? 'Export time' : '导出时间';
    const headerLogCount = language === 'en-US' ? 'Log count' : '日志条数';
    const headerDetail = language === 'en-US' ? 'Detail' : '详情';

    let content = `NeiLink ${locale.log.title}\n`;
    content += `${headerExportTime}: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n`;
    content += `${headerLogCount}: ${entries.length}\n`;
    content += `${'='.repeat(60)}\n\n`;

    for (const entry of entries) {
      const time = dayjs(entry.timestamp).format('YYYY-MM-DD HH:mm:ss');
      const translatedMessage = translateLogMessage(entry, locale);
      content += `[${time}] [${entry.type.toUpperCase()}] ${translatedMessage}`;
      if (entry.detail) {
        content += `\n  ${headerDetail}: ${entry.detail}`;
      }
      content += '\n';
    }

    fs.writeFileSync(exportPath, content, 'utf-8');
    return exportPath;
  }

  /**
   * 清理过期日志
   * @param retentionDays 保留天数
   */
  cleanupOldLogs(retentionDays: number): number {
    if (retentionDays === -1) return 0; // 永久保留，跳过清理
    try {
      const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      const allLogs = this.getLogs();
      const validLogs = allLogs.filter((entry) => entry.timestamp >= cutoffTime);
      const removedCount = allLogs.length - validLogs.length;

      if (removedCount > 0) {
        // 重写日志文件，只保留未过期的日志
        const lines = validLogs
          .sort((a, b) => a.timestamp - b.timestamp) // 按时间正序写入
          .map((entry) => JSON.stringify(entry))
          .join('\n') + '\n';

        fs.writeFileSync(this.logFilePath, lines, 'utf-8');
      }

      return removedCount;
    } catch (err) {
      this.log('error', '清理过期日志失败', {
        detail: err instanceof Error ? err.message : String(err),
        messageKey: 'error.cleanupLogs',
      });
      return 0;
    }
  }

  /**
   * 获取日志文件路径
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }
}
