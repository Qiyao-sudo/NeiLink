import React, { useState, useEffect, useCallback } from 'react';
import {
  List,
  Button,
  Space,
  Select,
  DatePicker,
  Tag,
  Typography,
  message,
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

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

type LogTypeFilter = 'all' | 'share' | 'download' | 'error' | 'system';
type TimeRange = 'today' | 'yesterday' | '7days' | '30days' | 'custom';

const LogPage: React.FC = () => {
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
      message.error('获取日志失败');
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
      message.success('过期日志已清理');
      fetchLogs();
    } catch {
      message.error('清理日志失败');
    }
  };

  const handleExportLogs = async () => {
    try {
      const result = await window.neilink.ipc.invoke('log:export') as string;
      if (result) {
        message.success(`日志已导出至: ${result}`);
      }
    } catch {
      message.error('导出日志失败');
    }
  };

  const handleTimeRangeChange = (value: TimeRange) => {
    setTimeRange(value);
    if (value !== 'custom') {
      setCustomDateRange(null);
    }
  };

  const typeTagMap: Record<string, { color: string; label: string }> = {
    share: { color: 'blue', label: '分享' },
    download: { color: 'green', label: '下载' },
    error: { color: 'red', label: '异常' },
    system: { color: 'purple', label: '系统' },
  };

  const renderLogItem = (item: LogEntry) => {
    const tagInfo = typeTagMap[item.type] || { color: 'default', label: item.type };
    const isError = item.type === 'error';

    return (
      <div className={`log-item ${isError ? 'log-item-error' : ''}`}>
        <span className="log-time">{dayjs(item.timestamp).format('YYYY-MM-DD HH:mm:ss')}</span>
        <span className={`log-type ${item.type}`}>{tagInfo.label}</span>
        <span
          className="log-message"
          style={isError ? { color: '#ff4d4f' } : undefined}
        >
          {item.message}
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
        <Title level={4} style={{ margin: 0 }}>日志查看</Title>
        <Space wrap>
          <Select
            value={timeRange}
            onChange={handleTimeRangeChange}
            style={{ width: 120 }}
            options={[
              { value: 'today', label: '今日' },
              { value: 'yesterday', label: '昨日' },
              { value: '7days', label: '近 7 天' },
              { value: '30days', label: '近 30 天' },
              { value: 'custom', label: '自定义' },
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
              { value: 'all', label: '全部类型' },
              { value: 'share', label: '分享' },
              { value: 'download', label: '下载' },
              { value: 'error', label: '异常' },
              { value: 'system', label: '系统' },
            ]}
          />
          <Tooltip title="刷新日志">
            <Button icon={<ReloadOutlined />} onClick={fetchLogs} />
          </Tooltip>
          <Button
            icon={<DeleteOutlined />}
            onClick={handleClearLogs}
          >
            清理过期日志
          </Button>
          <Button
            icon={<ExportOutlined />}
            onClick={handleExportLogs}
          >
            导出日志
          </Button>
        </Space>
      </div>

      {/* 日志列表 */}
      <div style={{
        background: '#fff',
        borderRadius: 8,
        border: '1px solid #e8e8e8',
        overflow: 'hidden',
      }}>
        <List
          loading={loading}
          dataSource={logs}
          renderItem={renderLogItem}
          locale={{
            emptyText: (
              <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
                <CalendarOutlined style={{ fontSize: 36, marginBottom: 12, color: '#d9d9d9' }} />
                <div>暂无日志记录</div>
              </div>
            ),
          }}
        />
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #f0f0f0',
          textAlign: 'center',
          color: '#999',
          fontSize: 12,
        }}>
          共 {totalCount} 条日志
        </div>
      </div>
    </div>
  );
};

export default LogPage;
