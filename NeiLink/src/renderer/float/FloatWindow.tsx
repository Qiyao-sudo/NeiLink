import React, { useState, useEffect, useCallback, useRef } from 'react';
import { App } from 'antd';
import logo from '../assets/logo.png';

const FloatWindow: React.FC = () => {
  const { message } = App.useApp();
  const [dragActive, setDragActive] = useState(false);
  const [visible, setVisible] = useState(true);
  const draggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const cleanup = window.neilink.ipc.on('float:set-visible', (show: unknown) => {
      setVisible(Boolean(show));
    });
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, []);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      draggingRef.current = true;
      lastPosRef.current = { x: e.screenX, y: e.screenY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = e.screenX - lastPosRef.current.x;
      const dy = e.screenY - lastPosRef.current.y;
      if (dx !== 0 || dy !== 0) {
        window.neilink.ipc.send('float:move', { dx, dy });
        lastPosRef.current = { x: e.screenX, y: e.screenY };
      }
    };

    const handleMouseUp = () => {
      draggingRef.current = false;
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      try {
        const filePath = window.neilink.getPathForFile(file);
        const result = await window.neilink.ipc.invoke('file:path-from-drop', filePath) as any;
        if (result?.success) {
          await window.neilink.ipc.invoke('float:file-dropped', {
            path: result.path,
            isFolder: result.isFolder,
          });
        } else {
          message.error('获取文件路径失败');
        }
      } catch {
        message.error('获取文件路径失败');
      }
    }
  }, [message]);

  if (!visible) return null;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.001)',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: dragActive
            ? '0 0 20px rgba(24, 144, 255, 0.5)'
            : '0 2px 8px rgba(0, 0, 0, 0.3)',
          transform: dragActive ? 'scale(1.15)' : 'scale(1)',
        }}
        title="拖拽文件/文件夹到此处分享"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <img
          src={logo}
          alt="NeiLink"
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
        />
      </div>
    </div>
  );
};

export default FloatWindow;
