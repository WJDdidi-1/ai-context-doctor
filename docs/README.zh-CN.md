# AI Context Doctor

[![npm](https://img.shields.io/npm/v/ai-context-doctor)](https://www.npmjs.com/package/ai-context-doctor)
[![CI](https://github.com/WJDdidi-1/ai-context-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/WJDdidi-1/ai-context-doctor/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/ai-context-doctor)](https://github.com/WJDdidi-1/ai-context-doctor/blob/main/LICENSE)
[![downloads](https://img.shields.io/npm/dm/ai-context-doctor)](https://www.npmjs.com/package/ai-context-doctor)

[English README](https://github.com/WJDdidi-1/ai-context-doctor/blob/main/README.md)

**AI 编程助手会一个文件一个文件地读你的仓库。其中有些文件其实没用——构建产物、日志、lockfile、一个 40 MB 的数据文件。这个工具几秒钟就能把它们找出来，告诉你哪些该挡在 AI 之外。**

```bash
npx ai-context-doctor
```

不用安装、不用登录、不需要 API key、不上传任何东西。它只看文件名和大小。

## 跑起来是什么样

下面是本项目自带的 demo 仓库的真实输出：

```text
AI Context Doctor

Repo: demo-ai-context-noise-repo
Scanned: 8 files, 1.50 MB

AI Context Health: 22/100
Status: Too much noise for an AI coding agent

Context noise estimate:
78% likely noise
22% likely useful source context

Top context waste:
1. data/export.json            1.00 MB   large file
2. dist/                      106.9 KB   generated build output
3. package-lock.json           35.2 KB   lockfile
4. logs/dev.log                18.4 KB   local log file
5. coverage/                   16.7 KB   test coverage output

Review before sharing:
- .env.example             environment template (usually safe to share)
- scripts/deploy.sh        deployment script

Suggested .aiignore:
coverage/
dist/
*.log
package-lock.json

Next step:
Run this before asking your coding agent to inspect a larger repo.
```

输出正文目前是英文，命令行参数也一样；本文件解释每一行是什么意思。

## 这份报告怎么读

| 这一行 | 意思 |
| --- | --- |
| `Scanned: 8 files, 1.50 MB` | 实际扫了多少内容。`.git/` 和 `node_modules/` 不扫。 |
| `AI Context Health: 22/100` | 100 减去「命中了噪音规则的文件」占的体积比例。22 分表示 AI 要读的东西里大部分是噪音。 |
| `Status:` | 把分数翻译成一句话：85 分以上干净，60–84 有噪音，60 分以下噪音太多。 |
| `Top context waste` | 体积最大的五个噪音来源，以及各自被标出来的原因。 |
| `Review before sharing` | 看起来像凭证或部署脚本的文件。**工具没有说它们一定是密钥**，只是提醒你：把这个仓库贴进聊天窗口之前先看一眼。 |
| `Suggested .aiignore` | 可以直接复制进忽略文件的行。工具不会替你写。 |

## 它是怎么判断的

![仓库和对话是怎么被打分的](https://raw.githubusercontent.com/WJDdidi-1/ai-context-doctor/main/docs/assets/architecture.svg)

两条路径读的是同一个判断函数，所以面板上的数字和「实际被挡住的文件」不会互相矛盾：扫描把文件夹拆成文件、字节和噪音并打分；Agent 的每一次读取都用同一套 `.aiignore` 规则和当前力度去判断。Optimize 写下的规则，下一次扫描和下一次读取都会立刻用上。

## 拿它能干什么

- **在让 AI 读一个大仓库之前**：先跑一遍，把建议的行贴进 `.aiignore`（或你所用助手的忽略配置），再跑一遍，看分数有没有变高。
- **刚 clone 下一个项目时**：先看看里面有多少是自动生成的产物，免得 AI 一上来就读这些。
- **CI 里**：用 `--json` 拿到稳定的结构化结果，上下文健康度掉下去就让构建失败。
- **自己的工具里**：`require('ai-context-doctor')` 可以直接调用同一套扫描。
- **在 DeepSeek Harness 里**：装上 [`dsh-aiignore`](https://www.npmjs.com/package/dsh-aiignore)，会话打开工作区时会自动提醒 AI 哪些文件会浪费上下文，你不用记着去跑任何东西。

## 安装

零安装直接跑：

```bash
npx ai-context-doctor
```

或者装一次：

```bash
npm install -g ai-context-doctor
```

需要 Node.js 18 或更新版本。

## 用法

```bash
ai-context-doctor              # 扫描当前目录
ai-context-doctor ../some-repo # 扫描另一个仓库
ai-context-doctor --json       # 机器可读输出
ai-context-doctor --write      # 把建议的规则写进 .aiignore
ai-context-doctor --write --dry-run   # 只看会加什么，不写文件
ai-context-doctor --help
ai-context-doctor --version
```

### 写入 `.aiignore`

```bash
npx ai-context-doctor --write
```

`--write` 会把报告建议的规则追加到被扫描目录的 `.aiignore`。它只追加：你已有的注释和规则原样保留，连续跑两次第二次什么都不会加。文件不存在时会新建，并带两行说明性注释。

`--write --dry-run` 只打印会加什么，不写文件。

它不会顺着符号链接写到别处，也拒绝把恰好叫 `.aiignore` 的目录替换掉。

扫描是基于文件名和大小的启发式判断，**不读 `.aiignore`**，所以写了文件分数不会变。这个文件是写给别的工具看的：你的助手、编辑器、以及你的同事。

### JSON 输出

```bash
npx ai-context-doctor ./some-repo --json
```

返回 `repo`、`healthScore`、`status`、`noisePercent`、`usefulPercent`、`scannedBytes`、`scannedFiles`、`topNoise`、`review`、`suggestedAiignore`；触发扫描上限时还会带 `truncated: true`。

加上 `--write` 时会多一个 `write` 对象：`path`、`created`、`added`、`written`、`dryRun`。

如果传入的路径不是可读目录，`--json` 只会输出一个 JSON 对象（不会先打印横幅），并以退出码 1 结束，CI 可以直接解析失败原因：

```json
{
  "error": "not-a-readable-directory",
  "message": "/path/you/passed is not a readable directory.",
  "target": "/path/you/passed"
}
```

## 在代码里调用

```js
const { scanRepository } = require('ai-context-doctor');

const report = scanRepository(process.cwd());
console.log(report.healthScore, report.topNoise);
```

`scanRepository(root, { maxFiles, maxBytes })` 是同步的，没有任何依赖。传上限可以低成本扫超大目录，此时报告会带 `truncated: true`。

## DeepSeek Harness 插件

[`dsh-aiignore`](https://www.npmjs.com/package/dsh-aiignore) 把同一套扫描封装成 Host 插件：会话打开工作区时，AI 会收到一条简短提示，说明哪些文件会浪费它的上下文；工作区干净时它什么都不说。

```bash
dsh plugin --profile web add dsh-aiignore
```

插件还会在右侧栏加一个 **AIignore** 标签（从输入框旁的文件夹按钮打开）。它一打开就是 **保护** 页：这次对话里有多少读取既是噪音、又已经被你的规则挡住，以及这些内容大约多少 tokens 从没有进入模型。优化之前它说的是实话版本——「2 次读取是噪音，仍然会进模型」——按钮因此有个可衡量的对象。下面只有一个主按钮「一键优化」：重新扫描、补上缺的规则、重新读取这次对话，并给出分数前后对比；没有可补的时候它会直说，而不是假装做了什么。紧挨着计数下面就是**力度阶梯**：五档，每档直接标出这个文件夹在这一档下的分数，所以在切换之前就能看到代价；点一档就生效，并当场重新评分。再下面一行是「再严格一档」，直接带上数字（「会多挡下 2 个文件，约 65k–81k tokens」）。**文件** 页按目录浏览工作区，并把三个标签的判断标准写在筛选器下面——噪音是构建产物、锁文件或日志，需留意是先看一眼再决定（环境文件、部署脚本、大数据文件），已在 .aiignore 是已经有规则挡住——接着列出扫描器还能补的规则，点一下就写入；**设置** 页放 `.aiignore` 的逐行清单（每行带 ×）、给 AI 的说明，以及折叠在底部的五维算法，力度则指向保护页。面板跟随 Harness 的浅色与深色主题。

![右侧栏里的上下文标签](https://raw.githubusercontent.com/WJDdidi-1/ai-context-doctor/main/docs/assets/panel-protection-light.png)

它声明了 `engines.dsh: ">=0.2.0"`：Harness 会在安装前检查这个范围，不符合就拒绝安装，而不是加载一半；同时需要 Node.js 18 或更新版本。在 [插件市场索引](https://raw.githubusercontent.com/WJDdidi-1/ai-context-doctor/main/market/index.json) 里它归在**上下文质量**分类下，带三个标签：*不联网*、*装好即用*、*在侧栏里*。没有侧栏服务时，同一个按钮会把面板打开成浮层卡片。源码、配置项与限制见 [`plugin/README.md`](https://github.com/WJDdidi-1/ai-context-doctor/blob/main/plugin/README.md)。

## 什么算噪音

- **目录**：`dist/`、`build/`、`coverage/`、`.next/`、`.turbo/`
- **Lockfile**：`package-lock.json`、`pnpm-lock.yaml`、`yarn.lock`
- **日志**：`*.log`
- **大文件**：超过 1 MB、且没有被更具体的规则命中的单个文件
- **需要检查**：看起来像凭证的文件名（`.env*`、`secrets.env`、`credentials.json`、`*.pem`、`*.key`）以及路径里带 `deploy` 的文件。`.env.example` 会被识别成模板，标记为通常可以分享。
- **不遍历**：`.git/`、`node_modules/`、`.venv/`、`venv/`、`__pycache__/`、`vendor/`

## 它不做什么

- 不调用任何 AI 服务，不需要 API key，不上传文件。
- 不修改你的仓库——不会写 `.aiignore`，也不会写别的文件。
- 不是 `gitignore` 检查器：它看的是「AI 会读到什么」，不是「git 跟踪什么」，所以被 git 忽略的文件照样会出现。
- 不是密钥扫描器。`Review` 列表基于文件名，没有扩展名的 `id_rsa`、粘在 `config.js` 里的密钥都会漏掉。
- 不统计 token，也不解析代码。分数是体积启发式：可以当真信号，不能当测量结果。
- 没有配置文件。上限只能通过 API 和 Harness 插件设置。

## 为什么建议 `.aiignore` 而不是 `.gitignore`

因为这是两个不同的问题。`dist/` 在大多数项目里都被 git 忽略了，但一个不看 git 规则的助手照样会去读它。这个工具报告的是「AI 会读进去多少字节」，跟 git 怎么想无关。

## 隐私

全部在本地运行。工具只读取目录项和文件大小，不读文件内容，不建立网络连接，不存储任何东西。唯一会发到外面的数据，是你用 npm 安装它时 npm 自己发的。

## 开发

```bash
git clone https://github.com/WJDdidi-1/ai-context-doctor.git
cd ai-context-doctor
npm test                       # 单元测试与 CLI 测试
node bin/ai-context-doctor.js ./demo-ai-context-noise-repo
```

`demo-ai-context-noise-repo/` 是一个故意做得很乱的仓库，随源码分发（不在 npm 包里），方便你直接试输出效果。

维护者：发布前看[发布 checklist](https://github.com/WJDdidi-1/ai-context-doctor/blob/main/docs/release-checklist.md)。发布在 CI 里通过 npm trusted publishing 完成，推 `v*` tag 即触发，`prepublishOnly` 会先跑测试，坏包发不出去。

## 后续计划

- 未知参数给出明确报错，而不是当成目录名。
- 根据真实用户反馈改进噪音规则。
- 可选的 `--fix`：写出建议的忽略条目，但要你先看过 diff 再决定。

## 许可证

Apache-2.0 —— 见 [LICENSE](https://github.com/WJDdidi-1/ai-context-doctor/blob/main/LICENSE)
与 [NOTICE](https://github.com/WJDdidi-1/ai-context-doctor/blob/main/NOTICE)。
早先的版本是 MIT，从 0.22.0 起改为 Apache-2.0。
