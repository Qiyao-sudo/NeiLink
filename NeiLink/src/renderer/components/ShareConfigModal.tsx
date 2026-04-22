import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Typography,
  Space,
  Alert,
  message,
} from 'antd';
import { CopyOutlined, LinkOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface ShareConfigModalProps {
  visible: boolean;
  filePath: string;
  isFolder?: boolean;
  defaultExtractCode?: boolean;
  defaultExpiry?: string;
  defaultMaxDownloads?: number;
  defaultMaxConcurrent?: number;
  onConfirm: (config: ShareFormConfig) => Promise<ShareResult | null>;
  onCancel: () => void;
}

export interface ShareFormConfig {
  filePath: string;
  useExtractionCode: boolean;
  extractionCode: string;
  expiry: string;
  maxDownloads: number;
  maxConcurrentDownloads: number;
}

export interface ShareResult {
  shareLink: string;
  extractionCode: string;
  hotspotName: string;
  hotspotPassword: string;
}

const ShareConfigModal: React.FC<ShareConfigModalProps> = ({
  visible,
  filePath,
  isFolder = false,
  defaultExtractCode = true,
  defaultExpiry = '24h',
  defaultMaxDownloads = -1,
  defaultMaxConcurrent = -1,
  onConfirm,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const [useExtractionCode, setUseExtractionCode] = useState(defaultExtractCode);
  const [loading, setLoading] = useState(false);
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);

  const fileName = filePath ? filePath.split(/[\\/]/).pop() || filePath : '';

  useEffect(() => {
    if (visible) {
      form.resetFields();
      setShareResult(null);
      setUseExtractionCode(defaultExtractCode);
      form.setFieldsValue({
        expiry: defaultExpiry,
        maxDownloads: defaultMaxDownloads,
        maxConcurrentDownloads: defaultMaxConcurrent,
      });
    }
  }, [visible, form, defaultExtractCode, defaultExpiry, defaultMaxDownloads, defaultMaxConcurrent]);

  const handleConfirm = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const config: ShareFormConfig = {
        filePath,
        useExtractionCode,
        extractionCode: useExtractionCode ? values.extractionCode : '',
        expiry: values.expiry,
        maxDownloads: values.maxDownloads,
        maxConcurrentDownloads: values.maxConcurrentDownloads,
      };

      const result = await onConfirm(config);
      if (result) {
        setShareResult(result);
      }
    } catch {
      // 表单验证失败
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (!shareResult) return;
    const text = shareResult.extractionCode
      ? `分享链接: ${shareResult.shareLink}\n提取码: ${shareResult.extractionCode}`
      : `分享链接: ${shareResult.shareLink}`;
    navigator.clipboard.writeText(text).then(() => {
      message.success('分享信息已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const handleClose = () => {
    setShareResult(null);
    onCancel();
  };

  return (
    <Modal
      title={shareResult ? '分享成功' : '分享配置'}
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={500}
      destroyOnHidden
    >
      {shareResult ? (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <CheckCircleOutlined
              style={{ fontSize: 48, color: '#52c41a', marginBottom: 12 }}
            />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>
              文件分享创建成功
            </div>
          </div>

          <div style={{ background: '#f6ffed', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">分享链接：</Text>
              <Paragraph
                copyable={{ text: shareResult.shareLink }}
                style={{ margin: 0, wordBreak: 'break-all' }}
              >
                {shareResult.shareLink}
              </Paragraph>
            </div>
            {shareResult.extractionCode && (
              <div>
                <Text type="secondary">提取码：</Text>
                <Text strong style={{ fontSize: 16, letterSpacing: 2 }}>
                  {shareResult.extractionCode}
                </Text>
              </div>
            )}
          </div>

          <Space style={{ width: '100%', justifyContent: 'center' }}>
            <Button
              type="primary"
              icon={<CopyOutlined />}
              onClick={copyLink}
            >
              复制分享信息
            </Button>
            <Button onClick={handleClose}>关闭</Button>
          </Space>

          {shareResult.hotspotName && (
            <Alert
              type="info"
              showIcon
              icon={<LinkOutlined />}
              style={{ marginTop: 16 }}
              message="热点连接信息"
              description={
                <div>
                  <div>热点名称: {shareResult.hotspotName}</div>
                  <div>热点密码: {shareResult.hotspotPassword}</div>
                </div>
              }
            />
          )}
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            useExtractionCode: defaultExtractCode,
            extractionCode: '',
            expiry: defaultExpiry,
            maxDownloads: defaultMaxDownloads,
            maxConcurrentDownloads: defaultMaxConcurrent,
          }}
        >
          <Form.Item label="文件名称">
            <Input
              value={fileName}
              readOnly
              prefix={isFolder ? '📁' : '📄'}
            />
          </Form.Item>

          <Form.Item label="提取码设置">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Switch
                checked={useExtractionCode}
                onChange={setUseExtractionCode}
              />
              {useExtractionCode && (
                <Form.Item
                  name="extractionCode"
                  noStyle
                  rules={[
                    { required: true, message: '请输入提取码' },
                    { min: 6, max: 12, message: '提取码长度为6-12位' },
                    {
                      pattern: /^[a-zA-Z0-9]+$/,
                      message: '仅支持数字和字母',
                    },
                  ]}
                >
                  <Input
                    placeholder="请输入6-12位提取码"
                    maxLength={12}
                    style={{ width: 200 }}
                  />
                </Form.Item>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              支持纯数字、字母、混合格式，6-12位
            </div>
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
            name="maxDownloads"
            label="最大下载次数"
          >
            <Select>
              <Select.Option value={1}>1 次</Select.Option>
              <Select.Option value={5}>5 次</Select.Option>
              <Select.Option value={10}>10 次</Select.Option>
              <Select.Option value={-1}>不限次数</Select.Option>
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

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={onCancel}>取消</Button>
              <Button
                type="primary"
                loading={loading}
                onClick={handleConfirm}
              >
                确认分享
              </Button>
            </Space>
          </div>
        </Form>
      )}
    </Modal>
  );
};

export default ShareConfigModal;
