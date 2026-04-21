# 贡献指南

感谢您对 NeiLink 项目的兴趣！我们欢迎各种形式的贡献，包括代码、文档、bug 报告和功能建议。

## 开发环境设置

1. **克隆仓库**
   ```bash
   git clone https://github.com/Qiyao-sudo/NeiLink.git
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
- `dev`：开发分支，包含最新开发内容
- `feature/xxx`：新功能、新模块开发
- `fix/xxx`：常规 Bug 修复
- `refactor/xxx`：代码重构、结构优化（不新增功能）
- `docs/xxx`：文档、注释、README 修改
- `style/xxx`：UI 样式、布局、配色调整
- `test/xxx`：测试、调试、验证性代码
- `fix/hotfix-xxx`：线上紧急修复（从 main 检出）

## Git 开发规范

### 总则
为保证项目代码历史清晰、分支结构稳定、协作流程统一，所有开发人员必须遵守本规范。禁止随意修改公共分支历史、禁止无意义提交、禁止危险操作滥用。

### 永久分支规范
#### 1. main
- 稳定发布分支，始终保持可直接部署、可运行。
- 禁止直接提交、禁止强制推送、禁止修改历史。
- 仅接受经过测试的 `dev` 分支或热修复分支合并。

#### 2. dev
- 开发集成主干分支，所有功能与修复均基于此分支开展。
- 禁止直接在 `dev` 上进行高频零散开发。
- 功能稳定后合并至 `main` 发布版本。

### 临时分支命名规范
所有临时分支均从 **dev** 检出，开发完成合并后可删除。

- `feature/xxx`：新功能、新模块开发
- `fix/xxx`：常规 Bug 修复
- `refactor/xxx`：代码重构、结构优化（不新增功能）
- `docs/xxx`：文档、注释、README 修改
- `style/xxx`：UI 样式、布局、配色调整
- `test/xxx`：测试、调试、验证性代码
- `fix/hotfix-xxx`：线上紧急修复（从 main 检出）

### 提交信息规范
格式：
`类型: 简要描述（中文、清晰、无歧义）`

类型说明：
- `feat:` 新增功能
- `fix:` 修复 Bug
- `refactor:` 重构
- `docs:` 文档
- `style:` 样式调整
- `test:` 测试相关

禁止使用：`更新`、`修改`、`修复`、`调试` 等无意义信息。

### Fork 协作规范
- 上游仓库（upstream）为官方基准，Fork 仓库（origin）为个人开发仓。
- Fork 仓库的 `main`/`dev` 必须定期与上游同步。
- 所有开发必须在独立功能分支进行，禁止直接修改 `main`。
- 完成开发通过 **PR** 合入上游 `dev` 分支。
- PR 提交前必须自行同步上游、解决冲突。

### 版本回退规范
#### 1. 本地未推送提交
可使用：
```
git reset --soft HEAD~1
```
保留代码，撤销最后一次提交。

#### 2. 已推送到远程公共分支
**必须使用 revert，禁止 reset 修改历史**
```
git revert <commit-hash>
```

#### 3. 严禁行为
- 禁止对已推送公共分支使用 `reset`、`rebase`、`amend`
- 禁止对 `main`/`dev` 强制推送

### 暂存与恢复规范（stash）
适用：代码未写完需切换分支、同步代码时。

```
git stash push -m "说明"
git stash list
git stash pop
```
禁止长期堆积大量未清理 stash。

### 提交修改规范（amend）
```
git commit --amend
```
- 仅允许修改**本地未推送**的最新提交。
- 已推送到远程公共分支严禁使用。

### 变基规范（rebase）
- 仅允许在**个人独立功能分支**整理历史使用。
- 严禁对 `main`/`dev` 等公共分支变基。
- 严禁变基已推送到共享仓库的提交。

### 版本标签规范（Tag）
发布版本使用语义化版本：
`v主版本.次版本.修订号`

```
git tag v1.0.0
git push origin --tags
```

### 危险操作警告
以下操作具有破坏性，必须谨慎：

1. `git reset --hard`
   会清除未提交修改，可能导致代码丢失。

2. `git push --force`
   仅允许在个人独立分支使用，严禁用于公共分支。

3. `git checkout -- <file>`
   直接丢弃文件修改，不可恢复。

4. 公共分支历史修改
   会导致协作者历史分叉、大量冲突、代码不可用。

### 冲突处理规范
- 只允许在 `dev` 或功能分支解决冲突。
- 禁止在 `main` 处理冲突。
- 冲突需按业务逻辑甄别，不得盲目覆盖。
- 解决后必须自测功能正常。

### 开发流程总结
1. 同步上游/远程最新代码
2. 从 `dev` 新建功能分支
3. 按规范开发、提交
4. 合并回 `dev` 并解决冲突
5. 测试稳定后合并 `main`
6. 发布并打版本 Tag

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

如果您发现 bug 或有功能建议，请在 [Issues](https://github.com/Qiyao-sudo/NeiLink/issues) 页面创建新的 issue。

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

- **GitHub Issues**：[https://github.com/Qiyao-sudo/NeiLink/issues](https://github.com/Qiyao-sudo/NeiLink/issues)

感谢您的贡献！