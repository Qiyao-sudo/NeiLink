# 贡献指南

感谢您对 NeiLink 项目的兴趣！我们欢迎各种形式的贡献，包括代码、文档、bug 报告和功能建议。

## 开发环境设置

1. **克隆仓库**
   ```bash
   git clone https://github.com/yourusername/neilink.git
   cd neilink
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **运行开发服务器**
   ```bash
   npm run dev
   ```

4. **构建项目**
   ```bash
   npm run build
   ```

## 代码风格

- 遵循 TypeScript 最佳实践
- 使用 2 空格缩进
- 代码行长度不超过 120 个字符
- 变量和函数命名使用驼峰命名法
- 类名使用 Pascal 命名法
- 常量使用全大写并使用下划线分隔

## 提交规范

我们使用以下提交消息格式：

```
<类型>(<范围>): <描述>

<详细描述>

<关闭的 issue>
```

### 类型

- `feat`：新功能
- `fix`：修复 bug
- `docs`：文档更新
- `style`：代码风格调整
- `refactor`：代码重构
- `test`：测试相关
- `chore`：构建或依赖更新

### 范围

范围可以是模块名、文件路径或功能名称，例如：
- `main`：主进程相关
- `renderer`：渲染进程相关
- `network`：网络相关
- `share`：分享功能相关

## 分支管理

- `main`：主分支，包含稳定版本
- `develop`：开发分支，包含最新开发内容
- `feature/xxx`：功能分支，用于开发新功能
- `fix/xxx`：修复分支，用于修复 bug

## 提交流程

1. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **开发和测试**
   - 实现功能或修复 bug
   - 确保代码通过构建
   - 测试功能是否正常工作

3. **提交代码**
   ```bash
   git add .
   git commit -m "feat(scope): 描述你的变更"
   ```

4. **推送分支**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **创建 Pull Request**
   - 在 GitHub 上创建 Pull Request
   - 描述你的变更内容和解决的问题
   - 等待审核

## 报告问题

如果您发现 bug 或有功能建议，请在 [Issues](https://github.com/yourusername/neilink/issues) 页面创建新的 issue。

### Bug 报告格式

- **标题**：简洁描述问题
- **环境**：操作系统、NeiLink 版本
- **步骤**：如何复现问题
- **预期结果**：期望的行为
- **实际结果**：实际发生的行为
- **截图**：如有可能，提供截图

### 功能建议格式

- **标题**：简洁描述功能
- **描述**：详细说明功能的用途和实现思路
- **理由**：为什么需要这个功能
- **可能的实现**：如果有，提供实现建议

## 行为准则

我们期望所有贡献者遵循以下行为准则：

- 尊重其他贡献者
- 接受建设性批评
- 专注于项目的最佳利益
- 对所有用户友好

## 联系我们

如果您有任何问题，可以通过以下方式联系我们：

- **GitHub Issues**：[https://github.com/yourusername/neilink/issues](https://github.com/yourusername/neilink/issues)

感谢您的贡献！