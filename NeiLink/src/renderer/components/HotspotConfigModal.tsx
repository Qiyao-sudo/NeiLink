import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';

interface HotspotConfigModalProps {
  visible: boolean;
  currentName: string;
  currentPassword: string;
  onConfirm: (name: string, password: string) => Promise<boolean>;
  onCancel: () => void;
}

const HotspotConfigModal: React.FC<HotspotConfigModalProps> = ({
  visible,
  currentName,
  currentPassword,
  onConfirm,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        hotspotName: currentName,
        hotspotPassword: currentPassword,
      });
    }
  }, [visible, currentName, currentPassword, form]);

  const handleConfirm = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const success = await onConfirm(values.hotspotName, values.hotspotPassword);
      if (success) {
        message.success('热点配置已更新');
      }
    } catch {
      // 表单验证失败
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="修改热点配置"
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={420}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          hotspotName: currentName,
          hotspotPassword: currentPassword,
        }}
      >
        <Form.Item
          name="hotspotName"
          label="热点名称"
          rules={[
            { required: true, message: '请输入热点名称' },
            { min: 1, max: 32, message: '热点名称长度为1-32个字符' },
          ]}
        >
          <Input placeholder="请输入热点名称" maxLength={32} />
        </Form.Item>

        <Form.Item
          name="hotspotPassword"
          label="热点密码"
          rules={[
            { required: true, message: '请输入热点密码' },
            { min: 8, max: 63, message: '密码长度为8-63个字符' },
          ]}
        >
          <Input.Password placeholder="请输入热点密码（8-63位）" maxLength={63} />
        </Form.Item>

        <div style={{ textAlign: 'right' }}>
          <Button onClick={onCancel} style={{ marginRight: 8 }}>
            取消
          </Button>
          <Button type="primary" loading={loading} onClick={handleConfirm}>
            保存
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default HotspotConfigModal;
