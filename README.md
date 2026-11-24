# DeepSeek Harness 飞书引用

周五要试产，你想让 DeepSeek 从评审纪要里列出待办。在对话框输入 `@评审`，看一眼作者，选中「首批试产评审纪要」，接着写「列出试产前的待办」。同一个输入框也能找群聊、同事、表格和知识空间。

[安装插件](#安装) · [查看发布版本](https://github.com/hayschan/dsh-feishu-mentions/releases)

## 引用文档，输入标题里的几个字

手动引用要去飞书搜索、打开文档，点「分享 → 复制链接」，再切回 Harness 粘贴。装上插件，在写问题的地方输入 `@评审` 就能选文档。两份纪要名字相近时，作者和修改时间可以帮你认出要用的那份。

![文档引用流程对比。左侧在飞书搜索并打开《首批试产评审纪要》，从分享面板复制链接，回到 Harness 粘贴。右侧在对话框输入 @评审，选中纪要并写下「列出试产前的待办」。](docs/images/mention-document.gif)

## 引用群聊，认出群头像就能选

手动找群聊 ID 要搜索群名、打开右上角「···」、把群设置滚到底，再复制会话 ID。现在输入 `@协调`，选中「试产协调群」，接着问「哪些物料还没到齐？」。

![群聊引用流程对比。左侧在飞书进入试产协调群，打开群设置，滚到最下方复制会话 ID，回到 Harness 粘贴。右侧在 Harness 输入 @协调，按群头像和群名选中，接着写物料问题。](docs/images/mention-chat.gif)

如果希望把评审纪要正文或最近的群消息也一起发给模型，选择 `@摘录:评审` 或 `@摘录:协调`。动图按飞书与 Harness 的界面和操作重绘，使用虚构的试产项目资料。[飞书的文档分享说明](https://www.feishu.cn/hc/zh-CN/articles/360049067526)

## 安装

1. 准备 DeepSeek Harness（已在 `0.2.2-rc.5` 验证）和飞书官方 CLI（已在 `1.0.97` 验证）。按官方 CLI 说明配置应用，登录自己的飞书账号，运行 `lark-cli auth status` 核对用户身份。读取范围取决于应用权限和当前用户可以访问的资料。[飞书 CLI 安装与授权](https://github.com/larksuite/cli)
2. 在桌面版打开 **插件 → 添加插件**，粘贴下面的安装地址，点击 **安装 → 立即启用**。其他版本的安装包见 [Releases](https://github.com/hayschan/dsh-feishu-mentions/releases)。

   ```text
   https://github.com/hayschan/dsh-feishu-mentions/releases/download/v0.4.0/dsh-feishu-mentions-0.4.0.tgz
   ```

3. 打开一个工作区，输入 `@`。看到飞书联系人、群聊和云盘资料后，选中一项就可以开始提问。

<details>
<summary>菜单提示找不到飞书 CLI？</summary>

在终端运行 `lark-cli auth status`。如果终端能找到 CLI，请确认 Harness 进程的 PATH 包含 `lark-cli`，或在启动环境中把 `DSH_FEISHU_CLI` 设为该可执行文件的绝对路径。插件也会检查 macOS 的常用 Homebrew 安装位置。

</details>

## 在提示词中使用

| 输入 | 菜单内容 |
| --- | --- |
| `@` | 最近联系过的人、活跃群聊、近一个月打开的资料和可见知识空间 |
| `@试产` | 跨类别搜索，可用鼠标或方向键和回车选择 |
| `@人:名字`、`@群:关键词` | 限定为联系人或群聊 |
| `@文档:关键词`、`@知识库:关键词` | 搜索云盘文件与知识库页面，或按名称查找知识空间 |
| `@摘录:关键词` | 选择文档或群聊，在发送时附上摘录 |

一条提示词可以引用多项。比如同时从 `@摘录:评审` 选中纪要，从 `@摘录:协调` 选中群聊，再问「纪要里列为缺料的项目，哪些已经在群里确认到货？」

普通引用随问题发送对象名称、链接或 ID 和可见元数据。选用摘录时，文档会附上前 6000 个 Unicode 字符，群聊会附上最近最多 10 条消息（合计最多 6000 个字符）。选中的内容会进入模型请求和会话记录。表格、文件夹和其他附件支持普通引用。

## 灵感来自豆包工作

在豆包工作里，写提示词时键入 `@` 就能选中飞书里的人、群聊和资料，再接着写问题。这个插件把同样的交互带到了 DeepSeek Harness，省去了来回复制文档链接和群聊 ID 的步骤。

![飞书 @ 菜单左右对比。左侧豆包工作按联系人、飞书对话和资料库分组，文档名后显示时间。右侧 DeepSeek Harness 插件在联系人姓名旁显示部门，在文档标题下显示作者和修改时间。](docs/images/feishu-mentions-comparison.png)

左侧依据豆包工作的深色菜单重绘，右侧依据运行中的 Harness 插件重绘。两边展示同一组虚构资料。在右侧可以看到「林澈」姓名旁的产品工程部，以及「首批试产评审纪要」标题下的作者和修改时间。

## 开发与反馈

<details>
<summary>本地开发与离线测试</summary>

使用 Node.js 22 或更高版本。测试使用虚构数据。

```sh
git clone https://github.com/hayschan/dsh-feishu-mentions.git
cd dsh-feishu-mentions
npm test
npm pack --dry-run
```

开发时可在 Harness 插件管理器中添加克隆目录的绝对路径。包名 `@local/dsh-feishu-mentions` 是 Harness 用来识别插件和已有引用的标识。插件运行时使用 Node.js 内置模块和宿主提供的 React。

</details>

欢迎通过 GitHub Issues 反馈问题，通过 pull request 提交功能或修复。复现样例请使用虚构的名称、链接和对象标识。[提交反馈](https://github.com/hayschan/dsh-feishu-mentions/issues)

## English quick start

Search Feishu contacts, chats, Drive files and wiki spaces from the native DeepSeek Harness `@` menu. Sign in to the official Feishu CLI with your own user identity, then paste the release tarball URL above into **Plugins → Add plugin** in Harness and enable it. Type `@` to browse or `@keyword` to search. Selecting an ordinary result attaches a reference. The explicit `@摘录:keyword` option also includes a document excerpt or recent chat messages when you send. The picker currently uses Chinese labels.

## License

MIT covers the source and the original file-type artwork in this repository. This is a community plugin. [License](LICENSE)
