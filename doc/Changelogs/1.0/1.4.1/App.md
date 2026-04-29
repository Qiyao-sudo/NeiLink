# 📝 版本更新日志
## [v1.4.1] - 2026-04-29

### ✨ 新增功能
- 🚀 新增 CI/CD 工作流，并改进错误日志记录
- ℹ️ 增强关于页面，添加作者信息及 Markdown 图片支持

### 🐛 问题修复
- 🔧 修复 `createEncryptStream` 返回类型中密码类型定义错误
- 🔧 修复构建工作流中 `npm ci` 命令为 `npm install`
- 🔧 确保发布流程中获取完整 Git 历史并自动创建缺失标签

### 🛠️ 代码重构
- ♻️ 简化 `createEncryptStream` 的返回类型

### 📦 依赖更新
- 📦 移除 `electron-updater` 依赖，版本号更新至 1.4.0
- 📦 添加 `package-lock.json` 并更新 `.gitignore` 配置