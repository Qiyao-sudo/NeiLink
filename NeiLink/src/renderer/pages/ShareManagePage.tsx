import React, { useState, useEffect, useCallback, useRef } from 'react';
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

const { Text } = Typography;

interface ShareTask {
  id: string;
  fileName: string;
  shareLink: string;
  extractionCode: string;
  expiry: string;
  remainingDownloads: number;
  maxConcurrentDownloads: number;
  uploaderNickname: string;
  createdAt: string;
}

interface EditConfigForm {
  extractionCode: string;
  expiry: string;
  maxConcurrentDownloads: number;
  uploaderNickname: string;
}

const ShareManagePage: React.FC = () => {
  const [tasks, setTasks] = useState<ShareTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<ShareTask | null>(null);
  const [editForm] = Form.useForm();
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.neilink.ipc.invoke('share:list') as ShareTask[];
      if (Array.isArray(result)) {
        setTasks(result);
      }
    } catch {
      message.error('获取分享列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    refreshTimer.current = setInterval(fetchTasks, 10000);
    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
    };
  }, [fetchTasks]);

  const handleRefresh = () => {
    fetchTasks();
  };

  const handleCopyLink = (record: ShareTask) => {
    const text = record.extractionCode
      ? `分享链接: ${record.shareLink}\n提取码: ${record.extractionCode}`
      : `分享链接: ${record.shareLink}`;
    navigator.clipboard.writeText(text).then(() => {
      message.success('分享信息已复制');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const handleEdit = (record: ShareTask) => {
    setEditingTask(record);
    editForm.setFieldsValue({
      extractionCode: record.extractionCode,
      expiry: record.expiry,
      maxConcurrentDownloads: record.maxConcurrentDownloads,
      uploaderNickname: record.uploaderNickname,
    });
    setEditModalVisible(true);
  };

  const handleEditConfirm = async () => {
    if (!editingTask) return;
    try {
      const values = await editForm.validateFields();
      await window.neilink.ipc.invoke('share:edit', {
        id: editingTask.id,
        ...values,
      });
      message.success('分享配置已更新');
      setEditModalVisible(false);
      fetchTasks();
    } catch {
      // 表单验证失败或请求失败
    }
  };

  const handleCancelShare = async (id: string) => {
    try {
      await window.neilink.ipc.invoke('share:cancel', { id });
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
          window.neilink.ipc.invoke('share:cancel', { id: key })
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

  const formatExpiry = (expiry: string) => {
    const map: Record<string, string> = {
      '1h': '1 小时',
      '6h': '6 小时',
      '24h': '24 小时',
      '7d': '7 天',
      '30d': '30 天',
      'permanent': '永久',
    };
    return map[expiry] || expiry;
  };

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
      render: (text: string) => (
        <Tooltip title={text}>
          <Text copyable={{ text }} style={{ fontSize: 12 }}>
            {text}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '提取码',
      dataIndex: 'extractionCode',
      key: 'extractionCode',
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
      render: (text: string) => formatExpiry(text),
    },
    {
      title: '剩余下载',
      dataIndex: 'remainingDownloads',
      key: 'remainingDownloads',
      width: 100,
      align: 'center' as const,
      render: (text: number) =>
        text === -1 ? <Tag color="green">不限</Tag> : <Text>{text}</Text>,
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
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
        >
          <Form.Item label="文件名称">
            <Input value={editingTask?.fileName} readOnly />
          </Form.Item>

          <Form.Item
            name="extractionCode"
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
            name="maxConcurrentDownloads"
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
            name="uploaderNickname"
            label="上传者昵称"
          >
            <Input placeholder="请输入昵称" maxLength={20} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ShareManagePage;
