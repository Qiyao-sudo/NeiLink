import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Switch, Typography } from 'antd';
import { useLanguage } from '../contexts/LanguageContext';

const { Text } = Typography;

interface HotspotConfigModalProps {
  visible: boolean;
  currentName: string;
  currentPassword: string;
  randomPasswordEnabled: boolean;
  onConfirm: (name: string, password: string, randomPassword: boolean) => Promise<boolean>;
  onCancel: () => void;
}

const HotspotConfigModal: React.FC<HotspotConfigModalProps> = ({
  visible,
  currentName,
  currentPassword,
  randomPasswordEnabled,
  onConfirm,
  onCancel,
}) => {
  const { locale } = useLanguage();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [useRandomPassword, setUseRandomPassword] = useState(randomPasswordEnabled);

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        hotspotName: currentName,
        hotspotPassword: currentPassword,
      });
      setUseRandomPassword(randomPasswordEnabled);
    }
  }, [visible, currentName, currentPassword, randomPasswordEnabled, form]);

  const handleConfirm = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await onConfirm(values.hotspotName, values.hotspotPassword, useRandomPassword);
    } catch {
      // form validation failed
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={locale.hotspot.modalTitle}
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
          label={locale.hotspot.nameLabel}
          rules={[
            { required: true, message: locale.hotspot.namePlaceholder },
            { min: 1, max: 32, message: locale.hotspot.namePlaceholder },
          ]}
        >
          <Input placeholder={locale.hotspot.namePlaceholder} maxLength={32} />
        </Form.Item>

        <Form.Item label={locale.hotspot.randomPassword}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={useRandomPassword}
              onChange={setUseRandomPassword}
              size="small"
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{locale.hotspot.randomPasswordDesc}</Text>
          </div>
        </Form.Item>

        {!useRandomPassword && (
          <Form.Item
            name="hotspotPassword"
            label={locale.hotspot.passwordLabel}
            rules={[
              { required: true, message: locale.hotspot.passwordPlaceholder },
              { min: 8, max: 63, message: locale.hotspot.passwordPlaceholder },
            ]}
          >
            <Input.Password placeholder={locale.hotspot.passwordPlaceholder} maxLength={63} />
          </Form.Item>
        )}

        <div style={{ textAlign: 'right' }}>
          <Button onClick={onCancel} style={{ marginRight: 8 }}>
            {locale.hotspot.cancel}
          </Button>
          <Button type="primary" loading={loading} onClick={handleConfirm}>
            {locale.hotspot.save}
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default HotspotConfigModal;
