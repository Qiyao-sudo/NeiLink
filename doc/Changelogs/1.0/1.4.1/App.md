# 📝 版本更新日志
## [v1.4.1] - 2026-04-29

### ✨ 新增功能
- 🚀 新增 CI/CD 工作流，完善自动化构建与发布流程
- 📝 增强关于页面，新增作者信息展示与 Markdown 图片支持
- 📦 新增 package-lock.json 文件，确保依赖版本一致性

### 🐛 问题修复
- 🔧 修复 createEncryptStream 返回类型中 cipher 类型定义错误
- 🔧 修复构建工作流中 npm ci 命令为 npm install，提升兼容性
- 🔧 修复发布流程中 Git 历史记录与标签自动创建逻辑

### 🚀 功能优化
- 🎯 简化 createEncryptStream 函数返回类型，提升代码可读性
- 📄 更新 package.json，补充 homepage 与 author 字段信息

### 🧹 代码重构
- 🗑️ 移除 electron-updater 依赖，精简项目依赖结构
- 🧹 清理 .gitignore 中 package-lock.json 的忽略规则
- 🧹 移除自动生成的 v1.3.0 版本日志条目

### 📦 依赖更新
- 📦 版本号升级至 1.4.0，并移除 electron-updater 相关依赖