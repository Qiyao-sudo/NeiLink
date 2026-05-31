# NeiLink 热点功能开发计划

## 📋 概述

完善 NeiLink 的热点功能，支持跨平台的网络热点管理。

---

## 🚀 阶段 1：核心功能（Windows 优先）

### 1.1 技术准备
- [x] 调研和选择合适的技术方案
- [x] 研究 Windows netsh 命令使用方法
- [x] 研究 Windows 无线网卡检测

### 1.2 完善 `hotspot.ts` 核心模块
- [x] `getHotspotStatus()` - 获取热点状态
- [x] `startHotspot()` - 启动热点
- [x] `stopHotspot()` - 停止热点
- [x] `configureHotspot()` - 配置热点
- [x] `isHotspotAvailable()` - 检测可用性

### 1.3 Windows 完整实现
- [x] 使用 PowerShell + WinRT NetworkOperatorTetheringManager API（主要方案）
- [x] 使用 netsh wlan hostednetwork 作为回退方案
- [x] 检测无线网卡支持
- [x] 完善错误处理与用户反馈
- [x] 友好的中文错误提示（权限、网卡支持等）

### 1.4 IPC 通道修复
- [x] 修复 HOTSPOT_CONFIG 未加入 preload 白名单
- [x] 修复 UI 传参 name/ssid 不一致问题

### 1.5 UI 交互完善
- [x] 热点开关传递当前配置
- [x] 处理热点启动/停止的错误返回
- [x] 显示热点错误信息
- [x] 显示连接设备数

### 1.6 日志与国际化
- [x] 添加热点相关日志消息类型定义
- [x] 添加中文翻译
- [x] 添加英文翻译
- [x] 热点启动/停止/配置事件记录日志

---

## 🛠️ 阶段 2：增强功能

### 2.1 状态持久化
- [ ] 保存热点配置到设置
- [ ] 记住上次状态

### 2.2 自动检测与回退
- [x] 检测平台兼容性
- [x] 不可用时友好提示

### 2.3 安全性
- [ ] 密码强度验证
- [x] 自动生成安全密码

---

## 🌐 阶段 3：多平台支持

### 3.1 macOS 支持
- [ ] 使用 networksetup 或 AppleScript
- [ ] 处理权限请求

### 3.2 Linux 支持
- [x] 检测可用工具（nmcli）
- [x] 基本实现（nmcli 命令）
- [ ] 提供安装指导

---

## 📊 技术方案

### 平台支持计划

| 平台 | 实现方式 | 技术依赖 | 状态 |
|------|---------|---------|------|
| **Windows 10/11** | PowerShell + WinRT NetworkOperatorTetheringManager（主）+ netsh（回退） | 自定义实现 | ✅ 已实现 |
| **macOS** | `networksetup` + `Internet Sharing` | 需管理员权限 | ⏳ 待实现 |
| **Linux** | `nmcli` | NetworkManager | ✅ 基本实现 |

---

## 📝 详细功能清单

### 基础功能
- [x] 开启/关闭热点
- [x] 配置热点名称（SSID）
- [x] 配置密码
- [x] 显示热点状态
- [x] 显示连接信息

### 高级功能
- [ ] 自动选择空闲信道
- [x] 显示已连接设备数
- [ ] 带宽/连接统计
- [x] 热点启动失败时的诊断信息

### 跨平台兼容性
- [x] Windows 10/11 完整支持
- [ ] macOS 基本支持（权限提示）
- [x] Linux 基本支持（nmcli）

---

## 🎨 UI/UX 增强（可选）
- [ ] 启动/停止动画
- [ ] 连接设备列表
- [ ] 热点信号强度指示
- [ ] 快速分享连接信息

---

## ⚠️ 风险与注意事项

| 风险 | 缓解方案 |
|------|---------|
| 系统权限要求 | 提供清晰的错误提示和指引 |
| 平台兼容性差异 | 功能降级，不可用时禁用 UI |
| 用户网络环境复杂 | 完善错误处理和诊断信息 |
| macOS 安全性限制 | 明确说明需要的权限 |

---

## 📌 执行顺序

1. **阶段 1**：Windows 核心功能 ✅ 已完成
2. **阶段 2**：增强功能
3. **阶段 3**：多平台支持（按需）

---

## 📚 参考资料
- Windows netsh wlan 文档
- macOS networksetup 命令
- Linux nmcli 文档

---

## 📝 开发日志

### 2026-05-13: 阶段 1 完成
- 实现 Windows netsh 命令管理热点
- 实现 Linux nmcli 命令管理热点
- macOS 预留接口，返回友好提示
- 修复 IPC 通道白名单缺失问题
- 修复 UI 传参 name/ssid 不一致问题
- 完善热点开关的错误处理
- 添加连接设备数显示
- 添加热点相关日志记录和国际化支持
