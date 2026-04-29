import React, { useState, useEffect, useCallback } from 'react';
import {
  List,
  Button,
  Space,
  Select,
  DatePicker,
  Tag,
  Typography,
  App,
  Tooltip,
} from 'antd';
import {
  DeleteOutlined,
  ExportOutlined,
  ReloadOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { LogEntry } from '../../shared/types';
import { translateLogMessage } from '../../shared/i18n';
import { useLanguage } from '../contexts/LanguageContext';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

type LogTypeFilter = 'all' | 'share' | 'download' | 'error' | 'system';
type TimeRange = 'today' | 'yesterday' | '7days' | '30days' | 'custom';

const LogPage: React.FC = () => {
  const { message } = App.useApp();
  const { locale, language } = useLanguage();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<LogTypeFilter>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [customDateRange, setCustomDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      let startTime: string | undefined;
      let endTime: string | undefined;

      const now = dayjs();
      switch (timeRange) {
        case 'today':
          startTime = now.startOf('day').toISOString();
          endTime = now.endOf('day').toISOString();
          break;
        case 'yesterday':
          startTime = now.subtract(1, 'day').startOf('day').toISOString();
          endTime = now.subtract(1, 'day').endOf('day').toISOString();
          break;
        case '7days':
          startTime = now.subtract(7, 'day').startOf('day').toISOString();
          endTime = now.endOf('day').toISOString();
          break;
        case '30days':
          startTime = now.subtract(30, 'day').startOf('day').toISOString();
          endTime = now.endOf('day').toISOString();
          break;
        case 'custom':
          if (customDateRange && customDateRange[0] && customDateRange[1]) {
            startTime = customDateRange[0].startOf('day').toISOString();
            endTime = customDateRange[1].endOf('day').toISOString();
          }
          break;
      }

      const result = await window.neilink.ipc.invoke('log:get-all', {
        type: typeFilter === 'all' ? undefined : typeFilter,
        startTime: startTime ? new Date(startTime).getTime() : undefined,
        endTime: endTime ? new Date(endTime).getTime() : undefined,
      }) as any;

      if (result && result.success && Array.isArray(result.data)) {
        setLogs(result.data);
        setTotalCount(result.data.length);
      }
    } catch {
      message.error(locale.notification.error);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, timeRange, customDateRange]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleClearLogs = async () => {
    try {
      await window.neilink.ipc.invoke('log:clear');
      message.success(locale.log.clearLogs);
      fetchLogs();
    } catch {
      message.error(locale.notification.error);
    }
  };

  const handleExportLogs = async () => {
    try {
      const result = await window.neilink.ipc.invoke('log:export', language) as any;
      if (result && result.success) {
        message.success(`日志已导出至: ${result.path}`);
      } else {
        message.error(locale.notification.error);
      }
    } catch {
      message.error(locale.notification.error);
    }
  };

  const handleTimeRangeChange = (value: TimeRange) => {
    setTimeRange(value);
    if (value !== 'custom') {
      setCustomDateRange(null);
    }
  };

  const typeTagMap: Record<string, { color: string }> = {
    share: { color: 'blue' },
    download: { color: 'green' },
    error: { color: 'red' },
    system: { color: 'purple' },
  };

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      share: locale.log.share,
      download: locale.log.download,
      error: locale.log.error,
      system: locale.log.system,
    };
    return labels[type] || type;
  };

  const renderLogItem = (item: LogEntry) => {
    const tagInfo = typeTagMap[item.type] || { color: 'default' };
    const isError = item.type === 'error';
    const displayMessage = translateLogMessage(item, locale);

    return (
      <div className={`log-item ${isError ? 'log-item-error' : ''}`}>
        <span className="log-time">{dayjs(item.timestamp).format('YYYY-MM-DD HH:mm:ss')}</span>
        <span className={`log-type ${item.type}`}>{getTypeLabel(item.type)}</span>
        <span
          className="log-message"
          style={isError ? { color: 'var(--color-error)' } : undefined}
        >
          {displayMessage}
        </span>
      </div>
    );
  };

  return (
    <div>
      {/* 顶部筛选栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <Title level={4} style={{ margin: 0 }}>{locale.log.title}</Title>
        <Space wrap>
          <Select
            value={timeRange}
            onChange={handleTimeRangeChange}
            style={{ width: 120 }}
            options={[
              { value: 'today', label: locale.log.today },
              { value: 'yesterday', label: locale.log.yesterday },
              { value: '7days', label: locale.log.last7Days },
              { value: '30days', label: locale.log.last30Days },
              { value: 'custom', label: locale.log.custom },
            ]}
          />
          {timeRange === 'custom' && (
            <RangePicker
              value={customDateRange}
              onChange={(dates) => setCustomDateRange(dates as [Dayjs | null, Dayjs | null] | null)}
              placeholder={['开始日期', '结束日期']}
            />
          )}
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 110 }}
            options={[
              { value: 'all', label: locale.log.allTypes },
              { value: 'share', label: locale.log.share },
              { value: 'download', label: locale.log.download },
              { value: 'error', label: locale.log.error },
              { value: 'system', label: locale.log.system },
            ]}
          />
          <Tooltip title={locale.common.refresh}>
            <Button icon={<ReloadOutlined />} onClick={fetchLogs} />
          </Tooltip>
          <Button
            icon={<DeleteOutlined />}
            onClick={handleClearLogs}
          >
            {locale.log.clearLogs}
          </Button>
          <Button
            icon={<ExportOutlined />}
            onClick={handleExportLogs}
          >
            {locale.log.exportLogs}
          </Button>
        </Space>
      </div>

      {/* 日志列表 */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 8,
        border: '1px solid var(--border-primary)',
        overflow: 'hidden',
      }}>
        <List
          loading={loading}
          dataSource={logs}
          renderItem={renderLogItem}
          locale={{
            emptyText: (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                <CalendarOutlined style={{ fontSize: 36, marginBottom: 12, color: 'var(--border-dashed)' }} />
                <div>{locale.log.noLogs}</div>
              </div>
            ),
          }}
        />
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border-secondary)',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 12,
        }}>
          {locale.log.totalLogs.replace('{count}', totalCount.toString())}
        </div>
      </div>
    </div>
  );
};

export default LogPage;
