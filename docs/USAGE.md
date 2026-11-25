# 飞书引用使用指南

## 安装与更新

已验证的版本为 DeepSeek Harness `0.2.2-rc.5` 和飞书 CLI `1.0.97`。运行 `lark-cli auth status` 可以查看当前登录的用户。搜索和摘录使用这个账号及飞书应用授予的权限。 [安装步骤](../README.md#安装)

- 安装其他版本时，选用对应的 `.tgz` 地址。 [GitHub Releases](https://github.com/hayschan/dsh-feishu-mentions/releases)
- npm 版上线后，在「插件 → 添加插件」输入 `@hayschan/dsh-feishu-mentions`。从 `.tgz` 迁移时，先到插件页移除旧版，再按包名安装。
- 通过 npm 安装后，在「设置 → 通用 → 飞书引用」点击「检查更新」。有可用的稳定版时，点击「确认安装」，再按界面提示操作。开发链接从本地克隆目录更新。

如果菜单提示找不到飞书 CLI，确认 `lark-cli` 在 Harness 进程的 `PATH` 中，或在启动 Harness 时将 `DSH_FEISHU_CLI` 设为该可执行文件的绝对路径。插件也会检查 macOS 上常见的 Homebrew 安装位置。

## 在对话中选资料

在空输入框或空格后输入 `@`，可以用鼠标选中结果，也可以按方向键和回车。一条消息里可以连续选择多项。

| 输入 | 用途 |
| --- | --- |
| `@` | 浏览联系过的人、活跃群聊、近一个月打开的资料和可见知识空间 |
| `@试产` | 跨类别搜索 |
| `@林澈`、`@linche`、`@lc` | 按姓名、全拼或拼音首字母找同事 |
| `@人:姓名`、`@群:群名` | 按类别找联系人或群聊 |
| `@文档:关键词`、`@知识库:关键词` | 搜索云盘文件与知识库页面，或按名称找知识空间 |
| `@摘录:关键词` | 选择飞书文档或群聊，发送时带上摘录 |

普通 `@` 引用附上对象名称、链接或标识，以及能看到的作者、部门、修改时间等信息。表格、文件夹和附件也支持普通引用。

## 附上文档或群消息

从 `@` 菜单点「附上飞书摘录…」，或直接输入 `@摘录:关键词`。发送时，云文档带上正文前 6,000 个字符。群聊带上最近最多 10 条消息，按时间先后排列，合计最多 6,000 个字符。发送后的引用和摘录会进入当前模型请求与会话记录。

要对照一份评审纪要和群里的最新说法，可以分别选两项摘录，再问「哪些变更还没记进纪要？请标出消息日期。」

## 把聊天整理到交接文档

让 Harness 能调用已登录的飞书 CLI，并确认当前账号可以读取来源会话、编辑目标文档。用两次普通 `@` 选择来源和目标，在问题里写清时间范围与写入位置。

> 把我和 `@林澈` 最近 3 天私聊里提到的物料进展追加到 `@试产交接记录` 文末。列出已到货物料、还要跟进的事项，以及林澈答应反馈的时间。

Harness 可按指定范围读取消息，将摘要追加到目标文档。把联系人换成项目群，也可以整理群里的交接事项。 [查看群聊交接演示](https://raw.githubusercontent.com/hayschan/dsh-feishu-mentions/main/docs/videos/recent-messages-to-doc.mp4)

## 演示

https://github.com/user-attachments/assets/a5930294-abfa-43a4-92d8-f2f3a3bc3505

演示按飞书与 Harness 的界面重绘，使用虚构的试产项目资料。 [MP4 版](https://raw.githubusercontent.com/hayschan/dsh-feishu-mentions/main/docs/videos/feishu-mentions-demo.mp4)

| 场景 | 飞书操作 | Harness 操作 |
| --- | --- | --- |
| 找云文档 | [复制文档链接](https://raw.githubusercontent.com/hayschan/dsh-feishu-mentions/main/docs/videos/feishu-document-manual.mp4) | [输入 `@物料`](https://raw.githubusercontent.com/hayschan/dsh-feishu-mentions/main/docs/videos/harness-document-direct.mp4) |
| 找群聊 | [复制会话 ID](https://raw.githubusercontent.com/hayschan/dsh-feishu-mentions/main/docs/videos/feishu-chat-manual.mp4) | [输入 `@协调`](https://raw.githubusercontent.com/hayschan/dsh-feishu-mentions/main/docs/videos/harness-chat-direct.mp4) |
| 找同事 | — | [按姓名、全拼和首字母选人](https://raw.githubusercontent.com/hayschan/dsh-feishu-mentions/main/docs/videos/harness-person-direct.mp4) |
| 比对纪要和群消息 | — | [同时附上两份摘录](images/harness-excerpts.webp) |

飞书引用的交互灵感来自豆包工作的飞书 `@` 菜单。 [查看菜单对照图](images/feishu-mentions-comparison.png)

## English quick start

In DeepSeek Harness, type `@` to pick a Feishu contact, group chat, Drive file or wiki space and keep writing your prompt. Type `@摘录:keyword` to attach a document excerpt or recent group messages when you send.

Sign in to the official Feishu CLI with your user account. In Harness, go to **Plugins → Add plugin**, paste the `.tgz` URL from the installation section and enable the plugin. [Get the installation URL](../README.md#安装)
