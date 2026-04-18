import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShareConfig } from '../../shared/types';
import {
  Table,
  Button,
  Input,
  Space,
  message,
  Modal,
  Form,
  Select,
  InputNumber,
  Typography,
  Tag,
  Tooltip,
  Popconfirm,
} from 'antd';
import {
  ReloadOutlined,
  DeleteOutlined,
  CopyOutlined,
  EditOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

interface ShareTask {
  id: string;
  fileName: string;
  shareLink: string;
  extractCode: string;
  expiry: string;
  remainingDownloads: number;
  maxConcurrentDownloads: number;
  uploaderNickname: string;
  createdAt: string;
  rawData: ShareConfig;
}

interface EditConfigForm {
  extractCode: string;
  expiry: string;
  maxConcurrent: number;
  maxDownloads: number;
}

interface NetworkInfo {
  isOnline: boolean;
  ip: string;
  type: 'wifi' | 'ethernet' | 'none';
}

const ShareManagePage: React.FC = () => {
  const [tasks, setTasks] = useState<ShareTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<ShareTask | null>(null);
  const [editForm] = Form.useForm<EditConfigForm>();
  const networkInfoRef = useRef<NetworkInfo>({
    isOnline: false,
    ip: '127.0.0.1',
    type: 'none',
  });
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const rawSharesRef = useRef<ShareConfig[]>([]);

  const updateShareLinks = useCallback((rawShares: ShareConfig[], currentIp: string) => {
    const convertedTasks = rawShares.map((share) => {
      let expiry: string;
      if (share.expiryTime) {
        const remaining = share.expiryTime - Date.now();
        if (remaining <= 0) {
          expiry = '已过期';
        } else {
          const seconds = Math.floor(remaining / 1000);
          const minutes = Math.floor(seconds / 60);
          const hours = Math.floor(minutes / 60);
          
          if (hours > 0) {
            expiry = `${hours} 小时`;
          } else if (minutes > 0) {
            expiry = `${minutes} 分钟`;
          } else {
            expiry = `${seconds} 秒`;
          }
        }
      } else {
        expiry = '永久';
      }
      
      return {
        id: share.id,
        fileName: share.fileName,
        shareLink: `http://${currentIp}:${share.port}/${share.id}`,
        extractCode: share.extractCode || '',
        expiry,
        remainingDownloads: share.maxDownloads === -1 ? -1 : share.maxDownloads - share.downloadCount,
        maxConcurrentDownloads: share.maxConcurrent,
        uploaderNickname: share.uploaderName,
        createdAt: dayjs(share.createdAt).format('YYYY-MM-DD HH:mm:ss'),
        rawData: share,
      };
    });
    setTasks(convertedTasks);
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.neilink.ipc.invoke('share:get-all') as any;
      if (result && result.success && Array.isArray(result.data)) {
        rawSharesRef.current = result.data;
        updateShareLinks(result.data, networkInfoRef.current.ip);
      }
    } catch {
      message.error('获取分享列表失败');
    } finally {
      setLoading(false);
    }
  }, [updateShareLinks]);

  const fetchNetworkInfo = useCallback(async () => {
    try {
      const result = await window.neilink.ipc.invoke('network:get-info') as any;
      if (result?.success && result.data) {
        const newIp = result.data.ip || '127.0.0.1';
        const oldIp = networkInfoRef.current.ip;
        networkInfoRef.current = result.data;
        if (newIp !== oldIp && rawSharesRef.current.length > 0) {
          updateShareLinks(rawSharesRef.current, newIp);
        }
      }
    } catch (error) {
      console.error('获取网络信息失败:', error);
    }
  }, [updateShareLinks]);

  useEffect(() => {
    fetchNetworkInfo();
    fetchTasks();
    refreshTimer.current = setInterval(fetchTasks, 10000);
    expiryTimer.current = setInterval(() => {
      if (rawSharesRef.current.length > 0) {
        updateShareLinks(rawSharesRef.current, networkInfoRef.current.ip);
      }
    }, 1000);
    
    const unsubscribe = window.neilink.ipc.on('network:on-change', () => {
      fetchNetworkInfo();
    });
    
    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
      if (expiryTimer.current) {
        clearInterval(expiryTimer.current);
      }
      unsubscribe();
    };
  }, [fetchTasks, fetchNetworkInfo, updateShareLinks]);

  const handleRefresh = () => {
    fetchTasks();
  };

  const handleCopyLink = (record: ShareTask) => {
    const rawShare = rawSharesRef.current.find(s => s.id === record.id);
    const currentLink = rawShare 
      ? `http://${networkInfoRef.current.ip}:${rawShare.port}/${record.id}`
      : record.shareLink;
    const text = record.extractCode
      ? `分享链接: ${currentLink}\n提取码: ${record.extractCode}`
      : `分享链接: ${currentLink}`;
    navigator.clipboard.writeText(text).then(() => {
      message.success('分享信息已复制');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const handleEdit = (record: ShareTask) => {
    setEditingTask(record);
    
    // 将 expiryTime 转换为 expiry 选项
    let expiry: string = 'permanent';
    if (record.rawData.expiryTime) {
      const now = Date.now();
      const hoursLeft = Math.ceil((record.rawData.expiryTime - now) / (1000 * 60 * 60));
      
      if (hoursLeft <= 1) expiry = '1h';
      else if (hoursLeft <= 6) expiry = '6h';
      else if (hoursLeft <= 24) expiry = '24h';
      else if (hoursLeft <= 168) expiry = '7d';
      else expiry = '30d';
    }
    
    editForm.setFieldsValue({
      extractCode: record.extractCode,
      expiry,
      maxConcurrent: record.maxConcurrentDownloads,
      maxDownloads: record.rawData.maxDownloads,
    });
    setEditModalVisible(true);
  };

  const handleEditConfirm = async () => {
    if (!editingTask) return;
    try {
      const values = await editForm.validateFields();
      
      // 转换 expiry 为 expiryTime
      let expiryTime: number | null | undefined;
      if (values.expiry === 'permanent') {
        // 用户明确选择永久，用null表示要清除过期时间
        expiryTime = null;
      } else {
        const now = Date.now();
        switch (values.expiry) {
          case '1h':
            expiryTime = now + 60 * 60 * 1000;
            break;
          case '6h':
            expiryTime = now + 6 * 60 * 60 * 1000;
            break;
          case '24h':
            expiryTime = now + 24 * 60 * 60 * 1000;
            break;
          case '7d':
            expiryTime = now + 7 * 24 * 60 * 60 * 1000;
            break;
          case '30d':
            expiryTime = now + 30 * 24 * 60 * 60 * 1000;
            break;
        }
      }
      
      // 构建更新配置
      const config = {
        extractCode: values.extractCode || undefined,
        expiryTime,
        maxConcurrent: values.maxConcurrent,
        maxDownloads: values.maxDownloads,
      };
      
      await window.neilink.ipc.invoke('share:update-config', editingTask.id, config);
      message.success('分享配置已更新');
      setEditModalVisible(false);
      fetchTasks();
    } catch (err) {
      console.error('更新分享配置失败:', err);
    }
  };

  const handleCancelShare = async (id: string) => {
    try {
      await window.neilink.ipc.invoke('share:cancel', id);
      message.success('分享已取消');
      fetchTasks();
    } catch {
      message.error('取消分享失败');
    }
  };

  const handleBatchCancel = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要取消的分享');
      return;
    }
    try {
      await Promise.all(
        selectedRowKeys.map((key) =>
          window.neilink.ipc.invoke('share:cancel', key)
        )
      );
      message.success(`已取消 ${selectedRowKeys.length} 个分享`);
      setSelectedRowKeys([]);
      fetchTasks();
    } catch {
      message.error('批量取消失败');
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (!searchText) return true;
    const lower = searchText.toLowerCase();
    return (
      task.fileName.toLowerCase().includes(lower) ||
      task.shareLink.toLowerCase().includes(lower)
    );
  });



  const columns = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      key: 'fileName',
      ellipsis: true,
      width: 180,
      render: (text: string) => (
        <Tooltip title={text}>
          <Text>{text}</Text>
        </Tooltip>
      ),
    },
    {
      title: '分享链接',
      dataIndex: 'shareLink',
      key: 'shareLink',
      ellipsis: true,
      width: 200,
      render: (text: string, record: ShareTask) => {
        const rawShare = rawSharesRef.current.find(s => s.id === record.id);
        const currentLink = rawShare 
          ? `http://${networkInfoRef.current.ip}:${rawShare.port}/${record.id}`
          : text;
        return (
          <Tooltip title={currentLink}>
            <Text copyable={{ text: currentLink }} style={{ fontSize: 12 }}>
              {currentLink}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: '提取码',
      dataIndex: 'extractCode',
      key: 'extractCode',
      width: 90,
      align: 'center' as const,
      render: (text: string) =>
        text ? <Tag color="blue">{text}</Tag> : <Tag>无</Tag>,
    },
    {
      title: '有效期',
      dataIndex: 'expiry',
      key: 'expiry',
      width: 90,
      align: 'center' as const,
    },
    {
      title: '剩余下载',
      key: 'remainingDownloads',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: ShareTask) =>
        record.rawData.maxDownloads === -1 ? <Tag color="green">不限</Tag> : <Text>{record.rawData.maxDownloads - record.rawData.downloadCount}</Text>,
    },
    {
      title: '最大同时下载',
      dataIndex: 'maxConcurrentDownloads',
      key: 'maxConcurrentDownloads',
      width: 110,
      align: 'center' as const,
      render: (text: number) =>
        text === -1 ? <Tag color="green">不限</Tag> : <Text>{text}</Text>,
    },
    {
      title: '上传者',
      dataIndex: 'uploaderNickname',
      key: 'uploaderNickname',
      width: 100,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <Text>{text}</Text>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, record: ShareTask) => (
        <Space size="small">
          <Tooltip title="复制链接">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopyLink(record)}
            />
          </Tooltip>
          <Tooltip title="编辑配置">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定取消此分享？"
            onConfirm={() => handleCancelShare(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="取消分享">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 顶部操作栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          分享管理
        </Typography.Title>
        <Space>
          <Input
            placeholder="搜索文件名/链接"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Popconfirm
            title={`确定取消选中的 ${selectedRowKeys.length} 个分享？`}
            onConfirm={handleBatchCancel}
            okText="确定"
            cancelText="取消"
            disabled={selectedRowKeys.length === 0}
          >
            <Button
              icon={<DeleteOutlined />}
              disabled={selectedRowKeys.length === 0}
            >
              批量取消
            </Button>
          </Popconfirm>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* 任务列表 */}
      <Table
        columns={columns}
        dataSource={filteredTasks}
        rowKey="id"
        loading={loading}
        size="middle"
        scroll={{ x: 1020 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条分享`,
        }}
      />

      {/* 编辑配置弹窗 */}
      <Modal
        title="编辑分享配置"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEditConfirm}
        okText="保存"
        cancelText="取消"
        width={450}
      >
        <Form
          form={editForm}
          layout="vertical"
        >
          <Form.Item label="文件名称">
            <Input value={editingTask?.fileName} readOnly />
          </Form.Item>

          <Form.Item
            name="extractCode"
            label="提取码"
            rules={[
              { min: 6, max: 12, message: '提取码长度为6-12位' },
              { pattern: /^[a-zA-Z0-9]*$/, message: '仅支持数字和字母' },
            ]}
          >
            <Input placeholder="留空则不使用提取码" maxLength={12} />
          </Form.Item>

          <Form.Item
            name="expiry"
            label="有效期"
          >
            <Select>
              <Select.Option value="1h">1 小时</Select.Option>
              <Select.Option value="6h">6 小时</Select.Option>
              <Select.Option value="24h">24 小时</Select.Option>
              <Select.Option value="7d">7 天</Select.Option>
              <Select.Option value="30d">30 天</Select.Option>
              <Select.Option value="permanent">永久</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="maxConcurrent"
            label="最大同时下载数"
          >
            <Select>
              <Select.Option value={3}>3 个</Select.Option>
              <Select.Option value={5}>5 个</Select.Option>
              <Select.Option value={10}>10 个</Select.Option>
              <Select.Option value={-1}>不限</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="maxDownloads"
            label="最大下载次数"
          >
            <Select>
              <Select.Option value={1}>1 次</Select.Option>
              <Select.Option value={3}>3 次</Select.Option>
              <Select.Option value={5}>5 次</Select.Option>
              <Select.Option value={10}>10 次</Select.Option>
              <Select.Option value={-1}>不限</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ShareManagePage;
