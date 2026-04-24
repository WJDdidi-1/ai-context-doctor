# AI Context Doctor

[English README](./README.md)

找出你的 AI 编程助手不应该优先读取的仓库内容。

AI Context Doctor 是一个早期可用的本地 CLI 原型。它会扫描一个仓库，提示哪些文件或目录可能浪费 Claude Code、Codex、Cursor、Cline 等 AI 编程工具的上下文。

## 当前状态

这个项目目前是一个本地 Node.js CLI 原型。

- 现在可用：克隆仓库后用 `node` 直接运行。
- 尚未发布到 npm：`npx ai-context-doctor` 是未来目标，不是当前可用安装方式。
- 不需要登录，不需要 API key，不上传文件。
- 输出结果是启发式估算，不是精确 token 计算，也不是安全扫描。

## 现在能做什么

- 扫描当前目录，或扫描你传入的一个本地目录。
- 识别常见上下文噪音，例如构建产物、框架缓存、覆盖率输出、lockfile、日志文件。
- 提醒你在分享给 AI 前检查 `.env*` 文件和部署脚本。
- 输出适合截图展示的终端报告。
- 基于简单规则给出 `.aiignore` 建议。

## 现在不能做什么

- 不调用 AI API。
- 不上传文件。
- 不修改你的仓库。
- 不自动生成或写入 `.aiignore`。
- 不提供 JSON 输出或配置系统。
- 不是安全扫描器，也不是漏洞检测工具。
- 不做精确 token 统计或 AST 分析。

## 快速开始

当前真实可用方式是先克隆仓库，再用 Node.js 运行：

```bash
git clone https://github.com/WJDdidi-1/ai-context-doctor.git
cd ai-context-doctor
node bin/ai-context-doctor.js
```

## 扫描当前目录

```bash
node bin/ai-context-doctor.js
```

## 扫描指定目录

```bash
node bin/ai-context-doctor.js ../some-repo
```

## 示例输出

```text
AI Context Doctor

Repo: my-project
Scanned: 428 files, 31.6 MB

AI Context Health: 62/100
Status: Too much noise for an AI coding agent

Context noise estimate:
73% likely noise
27% likely useful source context

Top context waste:
1. dist/                  18.4 MB   generated build output
2. package-lock.json       1.9 MB   lockfile
3. coverage/               1.2 MB   test coverage output
4. .next/cache/            980 KB   framework cache
5. logs/dev.log            420 KB   local log file

Review before sharing:
- .env.example             environment-like file
- scripts/deploy.sh        deployment script

Suggested .aiignore:
dist/
coverage/
.next/cache/
*.log
*.lock
.env*
```

## 为什么需要它

AI 编程工具读到的上下文越干净，越容易给出有用答案。真实仓库里经常混着构建产物、缓存、日志、覆盖率报告、lockfile 等内容，这些文件可能会让 AI 在真正重要的源码之前先读到大量噪音。

AI Context Doctor 的目标是在几秒内把这些噪音暴露出来。

## 当前启发式规则与限制

当前规则保持简单：

- 目录：`dist/`、`build/`、`coverage/`、`.next/`、`.turbo/`
- Lockfile：`package-lock.json`、`pnpm-lock.yaml`、`yarn.lock`
- 日志：`*.log`
- 需要检查：`.env*` 文件，以及路径中包含 `deploy` 的文件
- 跳过遍历：`.git/`、`node_modules/`

健康分和噪音比例是基于命中文件大小的粗略估算，只能作为快速信号，不是精确分析。

## 未来 npm 用法

项目尚未发布到 npm。未来目标是：

```bash
npx ai-context-doctor
```

在发布前，请使用上面的本地 `node bin/ai-context-doctor.js` 方式。

## 隐私与本地运行

AI Context Doctor 只在本地运行。它不需要登录，不需要 API key，不调用 AI 服务，也不会上传文件。

## 下一步

近期目标是继续保持规则小而清楚，补最小验证流程，并准备第一次 npm 发布。
