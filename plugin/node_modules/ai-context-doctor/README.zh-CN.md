# AI Context Doctor

[English README](https://github.com/WJDdidi-1/ai-context-doctor/blob/main/README.md)

找出你的 AI 编程助手不应该优先读取的仓库内容。

AI Context Doctor 是一个早期预览版的本地 CLI。它会扫描一个仓库，提示哪些文件或目录可能浪费 Claude Code、Codex、Cursor、Cline 等 AI 编程工具的上下文。

下面是运行 `ai-context-doctor ./demo-ai-context-noise-repo` 的示例输出（需先克隆本仓库）：

![AI Context Doctor 示例输出，展示上下文健康分、主要上下文噪音、复查提示和 .aiignore 建议](https://raw.githubusercontent.com/WJDdidi-1/ai-context-doctor/main/assets/ai-context-doctor-demo-output.png)

## 当前状态

项目已发布到 npm，当前是早期预览版（`0.1.x`）。

- 无需克隆即可运行：`npx ai-context-doctor`。
- 不需要登录，不需要 API key，不上传文件。
- 输出结果是启发式估算，不是精确 token 计算，也不是安全扫描。
- 规则集刻意保持精简，健康分只作快速信号，不是测量结果。

## 快速开始

扫描你当前所在目录：

```bash
npx ai-context-doctor
```

扫描其他本地仓库：

```bash
npx ai-context-doctor ../some-repo
```

如果不想每次都下载，也可以全局安装一次：

```bash
npm install -g ai-context-doctor
```

### 运行内置 demo

demo 仓库随源码分发，不包含在 npm 包里。想看在「故意做得很吵」的仓库上的效果，可以克隆后再跑：

```bash
git clone https://github.com/WJDdidi-1/ai-context-doctor.git
cd ai-context-doctor
node bin/ai-context-doctor.js ./demo-ai-context-noise-repo
```

## 现在能做什么

- 扫描当前目录，或扫描你传入的一个本地目录。
- 识别常见上下文噪音，例如构建产物、框架缓存、覆盖率输出、lockfile、日志文件，以及超过 1 MB 的单文件。
- 提醒你在分享给 AI 前检查 `.env*` 文件和部署脚本。
- 输出适合截图展示的终端报告。
- 基于简单规则给出 `.aiignore` 建议。

## 现在不能做什么

- 不调用 AI API。
- 不上传文件。
- 不修改你的仓库。
- 不自动生成或写入 `.aiignore`。
- 不提供配置系统。
- 不是安全扫描器，也不是漏洞检测工具。
- 不做精确 token 统计或 AST 分析。

## 快速开始

当前真实可用方式是先克隆仓库，再运行内置 demo：

```bash
git clone https://github.com/WJDdidi-1/ai-context-doctor.git
cd ai-context-doctor
node bin/ai-context-doctor.js ./demo-ai-context-noise-repo
```

然后再扫描当前目录或其他本地仓库。

## 扫描当前目录

```bash
npx ai-context-doctor
```

## 扫描指定目录

```bash
npx ai-context-doctor ../some-repo
```

## CLI 帮助

```bash
npx ai-context-doctor --help
npx ai-context-doctor --version
```

## JSON 输出

加 `--json` 可以得到供脚本或 CI 使用的机器可读结果：

```bash
npx ai-context-doctor ./some-repo --json
```

JSON 包含 `healthScore`、`noisePercent`、`topNoise`、`review` 和 `suggestedAiignore`。

如果传入的目录不可读，`--json` 仍会向 stdout 输出单个 JSON 对象并以退出码 1 结束，CI 可以直接解析失败原因：

```json
{
  "error": "not-a-readable-directory",
  "message": "/path/you/passed is not a readable directory.",
  "target": "/path/you/passed"
}
```

## 在代码中调用

同一个扫描逻辑也可以直接当函数用，其他工具不必再 shell 调用 CLI：

```js
const { scanRepository } = require('ai-context-doctor');

const report = scanRepository(process.cwd());
console.log(report.healthScore, report.topNoise);
```

`scanRepository(root, { maxFiles, maxBytes })` 是同步、无依赖的。传入上限即可
低成本扫描超大目录，此时报告会带 `truncated: true`。

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
2. data/export.json        2.4 MB   large file
3. package-lock.json       1.9 MB   lockfile
4. coverage/               1.2 MB   test coverage output
5. logs/dev.log            420 KB   local log file

Review before sharing:
- .env.example             environment-like file
- scripts/deploy.sh        deployment script

Suggested .aiignore:
dist/
coverage/
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
- 大文件：超过 1 MB 的单文件，除非它已经命中更具体的规则
- 需要检查：`.env*` 文件，以及路径中包含 `deploy` 的文件
- 跳过遍历：`.git/`、`node_modules/`

健康分和噪音比例是基于命中文件大小的粗略估算，只能作为快速信号，不是精确分析。

## 维护者说明

维护者在准备发布前，可以参考简短的 [发布前 checklist](https://github.com/WJDdidi-1/ai-context-doctor/blob/main/docs/release-checklist.md)。`npm publish` 会通过 `prepublishOnly` 先跑 smoke 检查，避免误发有问题的包。

## 隐私与本地运行

AI Context Doctor 只在本地运行。它不需要登录，不需要 API key，不调用 AI 服务，也不会上传文件。

## 下一步

近期目标是继续保持规则小而清楚，为规则函数补充单元测试并纳入 CI，并根据真实用户反馈改进噪音估算的准确性。
