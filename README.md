# DeepSeek Harness 飞书引用

在 DeepSeek Harness 输入框键入 `@`，就能搜索并引用飞书联系人、群聊、云文档和知识空间。插件使用每位用户自己的飞书 CLI 登录身份。联系人和群聊显示飞书头像，文档按类型显示图标，同时展示可见的作者和最后修改时间。

## 安装

1. 准备 DeepSeek Harness（已在 `0.2.2-rc.5` 验证）和飞书官方 CLI（已在 `1.0.97` 验证）。按官方 CLI 说明配置应用，登录自己的飞书账号，运行 `lark-cli auth status` 核对用户身份。读取范围取决于应用权限和当前用户可以访问的资料。[飞书 CLI 安装与授权](https://github.com/larksuite/cli)
2. 在桌面版打开 **插件 → 添加插件**，粘贴下面的安装地址，点击 **安装 → 立即启用**。其他版本的安装包见 [Releases](https://github.com/hayschan/dsh-feishu-mentions/releases)。

   ```text
   https://github.com/hayschan/dsh-feishu-mentions/releases/download/v0.4.0/dsh-feishu-mentions-0.4.0.tgz
   ```

3. 打开一个工作区，输入 `@`。如果菜单提示找不到 CLI，请确认 Harness 进程的 PATH 包含 `lark-cli`，或在启动环境中把 `DSH_FEISHU_CLI` 设为该可执行文件的绝对路径。插件也会检查 macOS 的常用 Homebrew 安装位置。

## 在提示词中使用

| 输入 | 菜单内容 |
| --- | --- |
| `@` | 最近联系过的人、活跃群聊、近一个月打开的资料和可见知识空间 |
| `@读书会` | 跨类别搜索，可用鼠标或方向键和回车选择 |
| `@人:名字`、`@群:关键词` | 限定为联系人或群聊 |
| `@文档:关键词`、`@知识库:关键词` | 搜索云盘文件与知识库页面，或按名称查找知识空间 |
| `@摘录:关键词` | 选择文档或群聊，在发送时附上摘录 |

可以在同一条提示词中选择多项。普通引用会将选中对象的名称、链接或 ID 及可见元数据随提示词发送给当前模型。选择摘录还会将云文档的前 6000 个 Unicode 字符，或最近最多 10 条群消息（合计最多 6000 字符）带入模型请求和会话记录。表格、文件夹和其他附件支持普通引用。联系人与群聊头像由客户端从飞书加载，仅用于显示。

部门在姓名右侧显示。文档优先显示已核实的原作者，无法核实时会明确标为所有者或作者未提供。修改时间使用查看者的本地时区，最近三天显示为今天、昨天或前天，同一年内省略年份。

## 开发与反馈

克隆仓库后，使用 Node.js 22 或更高版本。离线测试使用虚构数据，可以直接运行。

```sh
git clone https://github.com/hayschan/dsh-feishu-mentions.git
cd dsh-feishu-mentions
npm test
npm pack --dry-run
```

开发时可在 Harness 插件管理器中添加克隆目录的绝对路径。包名 `@local/dsh-feishu-mentions` 是 Harness 用来识别插件和已有引用的标识。插件运行时使用 Node.js 内置模块和宿主提供的 React。

欢迎通过 GitHub Issues 反馈问题，通过 pull request 提交功能或修复。复现样例请使用虚构的名称、链接和对象标识。[提交反馈](https://github.com/hayschan/dsh-feishu-mentions/issues)

## English quick start

Search Feishu contacts, chats, Drive files and wiki spaces from the native DeepSeek Harness `@` menu. Sign in to the official Feishu CLI with your own user identity, then paste the release tarball URL above into **Plugins → Add plugin** in Harness and enable it. Type `@` to browse or `@keyword` to search. Selecting an ordinary result attaches a reference. The explicit `@摘录:keyword` option also includes a document excerpt or recent chat messages when you send. The picker currently uses Chinese labels.

## License

MIT covers the source and the original file-type artwork in this repository. This is a community plugin. [License](LICENSE)
