/**
 * 日志系统模块
 * 使用 JSON Lines 格式存储日志到文件系统
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import dayjs from 'dayjs';
import { LogEntry } from '../../shared/types';

export class Logger {
  private logFilePath: string;
  private logDir: string;

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
   * 记录一条日志
   * @param type 日志类型
   * @param message 日志消息
   * @param detail 详细信息（可选）
   */
  log(type: LogEntry['type'], message: string, detail?: string): LogEntry {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type,
      message,
      detail,
    };

    // 追加写入日志文件（JSON Lines 格式，每行一个 JSON 对象）
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.logFilePath, line, 'utf-8');

    return entry;
  }

  /**
   * 获取日志列表
   * @param filter 过滤条件
   */
  getLogs(filter?: {
    type?: LogEntry['type'];
    startTime?: number;
    endTime?: number;
  }): LogEntry[] {
    try {
      const content = fs.readFileSync(this.logFilePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim() !== '');

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

      return entries;
    } catch (err) {
      this.log('error', '读取日志文件失败', err instanceof Error ? err.message : String(err));
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
  exportLogs(): string {
    const entries = this.getLogs();

    const exportDir = path.join(this.logDir, 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
    const exportPath = path.join(exportDir, `neilink_log_${timestamp}.txt`);

    let content = `NeiLink 日志导出\n`;
    content += `导出时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n`;
    content += `日志条数: ${entries.length}\n`;
    content += `${'='.repeat(60)}\n\n`;

    for (const entry of entries) {
      const time = dayjs(entry.timestamp).format('YYYY-MM-DD HH:mm:ss');
      content += `[${time}] [${entry.type.toUpperCase()}] ${entry.message}`;
      if (entry.detail) {
        content += `\n  详情: ${entry.detail}`;
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
      this.log('error', '清理过期日志失败', err instanceof Error ? err.message : String(err));
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
