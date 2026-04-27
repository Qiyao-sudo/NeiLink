import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Row, Col, Statistic, Select, Typography, Spin, Empty } from 'antd';
import {
  ArrowDownOutlined,
  CloudDownloadOutlined,
  FileAddOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import { LogEntry } from '../../shared/types';
import { useLanguage } from '../contexts/LanguageContext';

const { Text } = Typography;

type TimeRange = '7d' | '30d' | 'all';

interface DownloadDetail {
  fileSize: number;
  shareId: string;
  fileName: string;
}

function parseFileNameFromMessage(message: string): string {
  // 从 "文件下载成功: <fileName> (下载码: ...)" 中提取文件名
  const match = message.match(/文件下载成功:\s*(.+?)\s*\(下载码:/);
  return match ? match[1] : '';
}

function parseDetail(entry: LogEntry): DownloadDetail {
  if (entry.detail) {
    try {
      const d = JSON.parse(entry.detail);
      return {
        fileSize: typeof d.fileSize === 'number' ? d.fileSize : 0,
        shareId: typeof d.shareId === 'string' ? d.shareId : '',
        fileName: typeof d.fileName === 'string' ? d.fileName : '',
      };
    } catch {
      // JSON 解析失败，回退到 message 解析
    }
  }
  // 旧格式日志：从 message 中提取文件名，fileSize 无法恢复因此为 0
  return {
    fileSize: 0,
    shareId: '',
    fileName: parseFileNameFromMessage(entry.message),
  };
}

function formatTraffic(bytes: number, locale: any): string {
  if (bytes < 1024) return `${bytes} ${locale.stats.bytes}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${locale.stats.kb}`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} ${locale.stats.mb}`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ${locale.stats.gb}`;
}

function formatTrafficShort(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const StatsPage: React.FC = () => {
  const { locale } = useLanguage();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [downloadLogs, setDownloadLogs] = useState<LogEntry[]>([]);
  const [shareLogs, setShareLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let startTime: number | undefined;
      const endTime = Date.now();
      if (timeRange === '7d') {
        startTime = dayjs().subtract(7, 'day').startOf('day').valueOf();
      } else if (timeRange === '30d') {
        startTime = dayjs().subtract(30, 'day').startOf('day').valueOf();
      }

      const [downloadResult, shareResult] = await Promise.all([
        window.neilink.ipc.invoke('log:get-all', {
          type: 'download',
          startTime,
          endTime,
        }) as any,
        window.neilink.ipc.invoke('log:get-all', {
          type: 'share',
          startTime,
          endTime,
        }) as any,
      ]);

      if (downloadResult?.success && Array.isArray(downloadResult.data)) {
        setDownloadLogs(downloadResult.data as LogEntry[]);
      }
      if (shareResult?.success && Array.isArray(shareResult.data)) {
        setShareLogs(shareResult.data as LogEntry[]);
      }
    } catch (err) {
      console.error('Failed to fetch stats data:', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 概览统计
  const summary = useMemo(() => {
    const totalDownloads = downloadLogs.length;
    let totalTraffic = 0;
    const fileSet = new Set<string>();
    for (const entry of downloadLogs) {
      const detail = parseDetail(entry);
      totalTraffic += detail.fileSize;
      if (detail.fileName) fileSet.add(detail.fileName);
    }
    return {
      totalDownloads,
      totalTraffic,
      uniqueFiles: shareLogs.length || fileSet.size,
    };
  }, [downloadLogs, shareLogs]);

  // 下载趋势数据（按天分桶）
  const downloadsTimeSeries = useMemo(() => {
    const buckets: Record<string, { date: string; downloads: number; traffic: number }> = {};
    const now = dayjs();
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 0;

    // 计算起始日期
    let startDate: dayjs.Dayjs;
    if (days > 0) {
      startDate = now.subtract(days - 1, 'day').startOf('day');
    } else if (downloadLogs.length > 0) {
      startDate = dayjs(
        Math.min(...downloadLogs.map((l) => l.timestamp))
      ).startOf('day');
    } else {
      startDate = now.subtract(6, 'day').startOf('day');
    }

    // 初始化所有日期的 bucket 为 0
    const totalDays = Math.max(days, now.diff(startDate, 'day') + 1);
    for (let i = 0; i < totalDays; i++) {
      const date = startDate.add(i, 'day').format('YYYY-MM-DD');
      buckets[date] = { date, downloads: 0, traffic: 0 };
    }

    // 聚合下载日志
    for (const entry of downloadLogs) {
      const date = dayjs(entry.timestamp).format('YYYY-MM-DD');
      if (buckets[date]) {
        buckets[date].downloads++;
        buckets[date].traffic += parseDetail(entry).fileSize;
      }
    }

    return Object.values(buckets);
  }, [downloadLogs, timeRange]);

  // Top 文件
  const topFiles = useMemo(() => {
    const fileMap: Record<string, { name: string; count: number }> = {};
    for (const entry of downloadLogs) {
      const detail = parseDetail(entry);
      const name = detail.fileName || 'Unknown';
      if (!fileMap[name]) fileMap[name] = { name, count: 0 };
      fileMap[name].count++;
    }
    return Object.values(fileMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [downloadLogs]);

  // 读取主题 CSS 变量
  const getThemeColor = (name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const primaryColor = getThemeColor('--color-primary') || '#1890ff';
  const successColor = getThemeColor('--color-success') || '#52c41a';
  const textSecondary = getThemeColor('--text-secondary') || '#666';
  const bgSecondary = getThemeColor('--bg-secondary') || '#fff';

  if (loading && downloadLogs.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* 标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Text strong style={{ fontSize: 18, color: 'var(--text-primary)' }}>
          {locale.stats.title}
        </Text>
        <Select
          value={timeRange}
          onChange={(val) => setTimeRange(val)}
          style={{ width: 120 }}
          options={[
            { value: '7d', label: locale.stats.timeRange7d },
            { value: '30d', label: locale.stats.timeRange30d },
            { value: 'all', label: locale.stats.timeRangeAll },
          ]}
        />
      </div>

      {/* 概览卡片 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title={locale.stats.totalDownloads}
              value={summary.totalDownloads}
              prefix={<ArrowDownOutlined />}
              valueStyle={{ color: primaryColor }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title={locale.stats.cumulativeTraffic}
              value={formatTraffic(summary.totalTraffic, locale)}
              prefix={<CloudDownloadOutlined />}
              valueStyle={{ color: successColor, fontSize: summary.totalTraffic > 1024 * 1024 * 1024 ? 18 : 24 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title={locale.stats.totalFilesShared}
              value={summary.uniqueFiles}
              prefix={<FileAddOutlined />}
              valueStyle={{ color: primaryColor }}
            />
          </Card>
        </Col>
      </Row>

      {/* 下载趋势图 */}
      {downloadLogs.length === 0 ? (
        <Card>
          <Empty description={locale.stats.noData} />
        </Card>
      ) : (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Card title={locale.stats.downloadsOverTime}>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={downloadsTimeSeries}>
                    <defs>
                      <linearGradient id="downloadGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={textSecondary} opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: textSecondary }}
                      tickFormatter={(val: string) => dayjs(val).format('MM/DD')}
                    />
                    <YAxis tick={{ fontSize: 12, fill: textSecondary }} allowDecimals={false} />
                    <Tooltip
                      labelFormatter={(val) => dayjs(val as string).format('YYYY-MM-DD')}
                      contentStyle={{ background: bgSecondary, border: '1px solid var(--border-primary)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="downloads"
                      stroke={primaryColor}
                      fill="url(#downloadGradient)"
                      strokeWidth={2}
                      name={locale.stats.totalDownloads}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col span={12}>
              <Card title={locale.stats.trafficOverTime}>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={downloadsTimeSeries}>
                    <defs>
                      <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={successColor} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={successColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={textSecondary} opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: textSecondary }}
                      tickFormatter={(val: string) => dayjs(val).format('MM/DD')}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: textSecondary }}
                      tickFormatter={formatTrafficShort}
                    />
                    <Tooltip
                      labelFormatter={(val) => dayjs(val as string).format('YYYY-MM-DD')}
                      formatter={(value) => [formatTraffic(value as number, locale)]}
                      contentStyle={{ background: bgSecondary, border: '1px solid var(--border-primary)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="traffic"
                      stroke={successColor}
                      fill="url(#trafficGradient)"
                      strokeWidth={2}
                      name={locale.stats.cumulativeTraffic}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          {/* Top 文件 */}
          <Card title={locale.stats.topFiles}>
            {topFiles.length === 0 ? (
              <Empty description={locale.stats.noData} />
            ) : (
              <ResponsiveContainer width="100%" height={40 * topFiles.length + 40}>
                <BarChart data={topFiles} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={textSecondary} opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: textSecondary }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12, fill: textSecondary }}
                    width={180}
                  />
                  <Tooltip
                    contentStyle={{ background: bgSecondary, border: '1px solid var(--border-primary)' }}
                  />
                  <Bar dataKey="count" fill={primaryColor} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default StatsPage;
