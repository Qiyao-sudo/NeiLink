import React, { useState } from 'react';
import { Modal, Checkbox, Space, Button } from 'antd';
import { useLanguage } from '../contexts/LanguageContext';

interface CloseDialogProps {
  visible: boolean;
  onClose: (action: 'minimize' | 'exit', dontAskAgain: boolean) => void;
  onDismiss: () => void;
}

const CloseDialog: React.FC<CloseDialogProps> = ({ visible, onClose, onDismiss }) => {
  const { locale } = useLanguage();
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const handleAction = (action: 'minimize' | 'exit') => {
    onClose(action, dontAskAgain);
    setDontAskAgain(false);
  };

  return (
    <Modal
      title={locale.closeDialog.title}
      open={visible}
      footer={null}
      onCancel={onDismiss}
      width={360}
      centered
    >
      <p style={{ marginBottom: 16 }}>{locale.closeDialog.message}</p>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Button
          block
          type="primary"
          onClick={() => handleAction('minimize')}
        >
          {locale.closeDialog.minimizeToTray}
        </Button>
        <Button
          block
          onClick={() => handleAction('exit')}
        >
          {locale.closeDialog.exitApp}
        </Button>
      </Space>
      <Checkbox
        checked={dontAskAgain}
        onChange={(e) => setDontAskAgain(e.target.checked)}
        style={{ marginTop: 16 }}
      >
        {locale.closeDialog.dontAskAgain}
      </Checkbox>
    </Modal>
  );
};

export default CloseDialog;
