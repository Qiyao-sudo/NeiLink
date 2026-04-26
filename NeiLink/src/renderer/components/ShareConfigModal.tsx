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
import { useLanguage } from '../contexts/LanguageContext';

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
  const { locale } = useLanguage();
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
      title={shareResult ? locale.shareConfig.shareSuccess : locale.shareConfig.title}
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
              {locale.shareConfig.shareSuccess}
            </div>
          </div>

          <div style={{ background: '#f6ffed', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">{locale.shareConfig.shareLink}：</Text>
              <Paragraph
                copyable={{ text: shareResult.shareLink }}
                style={{ margin: 0, wordBreak: 'break-all' }}
              >
                {shareResult.shareLink}
              </Paragraph>
            </div>
            {shareResult.extractionCode && (
              <div>
                <Text type="secondary">{locale.shareConfig.extractCode}：</Text>
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
              {locale.shareConfig.copyShareInfo}
            </Button>
            <Button onClick={handleClose}>{locale.common.close}</Button>
          </Space>

          {shareResult.hotspotName && (
            <Alert
              type="info"
              showIcon
              icon={<LinkOutlined />}
              style={{ marginTop: 16 }}
              message={locale.shareConfig.hotspotInfo}
              description={
                <div>
                  <div>{locale.shareConfig.hotspotName}: {shareResult.hotspotName}</div>
                  <div>{locale.shareConfig.hotspotPassword}: {shareResult.hotspotPassword}</div>
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
          <Form.Item label={locale.shareConfig.fileName}>
            <Input
              value={fileName}
              readOnly
              prefix={isFolder ? '📁' : '📄'}
            />
          </Form.Item>

          <Form.Item label={locale.shareConfig.extractCodeSetting}>
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
                    { required: true, message: locale.shareConfig.enterExtractCode },
                    { min: 6, max: 12, message: locale.shareConfig.extractCodeLength },
                    {
                      pattern: /^[a-zA-Z0-9]+$/,
                      message: locale.shareConfig.extractCodeFormat,
                    },
                  ]}
                >
                  <Input
                    placeholder={locale.shareConfig.extractCodePlaceholder}
                    maxLength={12}
                    style={{ width: 200 }}
                  />
                </Form.Item>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              {locale.shareConfig.extractCodeHint}
            </div>
          </Form.Item>

          <Form.Item
            name="expiry"
            label={locale.shareConfig.expiry}
          >
            <Select>
              <Select.Option value="1h">1 {locale.shareConfig.hour}</Select.Option>
              <Select.Option value="6h">6 {locale.shareConfig.hour}</Select.Option>
              <Select.Option value="24h">24 {locale.shareConfig.hour}</Select.Option>
              <Select.Option value="7d">7 {locale.shareConfig.day}</Select.Option>
              <Select.Option value="30d">30 {locale.shareConfig.day}</Select.Option>
              <Select.Option value="permanent">{locale.shareConfig.permanent}</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="maxDownloads"
            label={locale.shareConfig.maxDownloads}
          >
            <Select>
              <Select.Option value={1}>1 次</Select.Option>
              <Select.Option value={5}>5 次</Select.Option>
              <Select.Option value={10}>10 次</Select.Option>
              <Select.Option value={-1}>{locale.shareConfig.unlimited}</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="maxConcurrentDownloads"
            label={locale.shareConfig.maxConcurrentDownloads}
          >
            <Select>
              <Select.Option value={3}>3 个</Select.Option>
              <Select.Option value={5}>5 个</Select.Option>
              <Select.Option value={10}>10 个</Select.Option>
              <Select.Option value={-1}>{locale.shareConfig.unlimited}</Select.Option>
            </Select>
          </Form.Item>

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={onCancel}>{locale.common.cancel}</Button>
              <Button
                type="primary"
                loading={loading}
                onClick={handleConfirm}
              >
                {locale.shareConfig.confirmShare}
              </Button>
            </Space>
          </div>
        </Form>
      )}
    </Modal>
  );
};

export default ShareConfigModal;
