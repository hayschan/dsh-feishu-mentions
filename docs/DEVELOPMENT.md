# 开发与发布

## 本地开发

使用 Node.js 22 或更高版本。在 Harness 的「插件 → 添加插件」输入克隆目录的绝对路径，即可加载开发版。

```sh
git clone https://github.com/hayschan/dsh-feishu-mentions.git
cd dsh-feishu-mentions
npm test
node scripts/test-public.mjs dist
```

开发版标识为 `@local/dsh-feishu-mentions`。打包脚本将插件清单、Cordis 配置和客户端标识统一为公开包名 `@hayschan/dsh-feishu-mentions`。`test-public.mjs` 验证安装包里的标识并在解包后运行回归测试。 [打包脚本](../scripts/pack-public.mjs) · [测试](../test.mjs)

## 发布

首次 npm 发布由该 scope 的维护者运行 `npm publish dist/dsh-feishu-mentions-0.5.0.tgz --access public`。在 npm 的 Trusted Publisher 设置中选择 GitHub Actions，指定仓库 `hayschan/dsh-feishu-mentions` 和工作流 `release.yml`。

后续发布时，更新 `package.json` 版本并推送对应的 `vX.Y.Z` 标签。工作流校验版本、运行回归测试，将同一 `.tgz` 发布到 npm 和 GitHub Releases。重跑标签任务时，工作流会比对已有版本的包完整性。 [发布工作流](../.github/workflows/release.yml)

## 搜索与回归

四类来源并行查询。每类来源为当前会话缓存最多 32 组查询结果，有效期 15 秒。头像和作者补查各有 900 毫秒的时限，到期时返回已有信息。选中的摘录在发送时读取。 [客户端实现](../client.js) · [飞书读取实现](../lark.js)

2026-11-25 的单次离线对照让每次模拟请求等待 40 毫秒。打开 `@` 从 287 毫秒降到 51 毫秒，首次搜索从 263 毫秒降到 144 毫秒。同会话立即重复搜索从 264 毫秒降到不足 1 毫秒，请求数从 4 降到 0。

离线回归使用合成 CLI 和 Harness Host 响应，覆盖四类搜索、缓存、引用、摘录和更新流程。复现问题时，用虚构的名称、链接和对象标识提供最小示例。 [反馈问题](https://github.com/hayschan/dsh-feishu-mentions/issues)

## README 演示素材

README 顶部循环播放 35 秒的 WebP 动图，分辨率为 800 × 450，按每秒 8 帧采样，文件为 326 KB。点动图可打开使用指南的完整视频播放器。 [WebP 动图](images/feishu-mentions-demo.webp)

当前 35 秒宣传片在 0、11、22 秒分别进入「云文档」「群聊」「联系人」。每段开场只放图标和章节名。云文档和群聊先播放左侧手动流程，再播放右侧 `@` 引用。两侧完成后显示各自耗时和步数。联系人段展示姓名、全拼和首字母三种输入。五段短动图去掉底部说明条，其中云文档、群聊和联系人各有一张类型卡。

步数从 Harness 的输入框开始，算到引用进入输入框。

- 云文档手动引用 8 步。切到飞书 → 打开搜索 → 输入关键词 → 打开文档 → 点分享 → 复制链接 → 切回 Harness → 粘贴。
- 群聊手动引用 9 步。切到飞书 → 打开搜索 → 输入关键词 → 打开群聊 → 打开设置 → 滚动找到会话 ID → 复制 ID → 切回 Harness → 粘贴。
- `@` 引用 2 步。输入 `@关键词` → 选中结果。

主片的 VP9 / WebM 为 721 KB，H.264 / MP4 版为 860 KB，两版均为 1920 × 1080、30 帧/秒。WebM 使用屏幕内容模式和文件前置索引，MP4 使用 `faststart`。2026-11-25 在 GitHub 公开预览中核对了新版播放器与媒体分段读取。 [WebM 主片](videos/feishu-mentions-demo.webm) · [MP4 版](videos/feishu-mentions-demo.mp4)

### 早期剪辑的编码对照

2026-11-25 用同一支 35 秒原片对比编码，均保留 1920 × 1080、30 帧/秒。VMAF 每 5 帧取 1 帧计算，共 210 帧。首帧时间在隔离的 Chrome 中测量，连接限速 1.5 Mbps，每次媒体请求延迟 75 毫秒。三次冷加载取中位数。 [对照原片](https://github.com/hayschan/dsh-feishu-mentions/blob/3007ed7/docs/videos/feishu-mentions-demo.mp4)

| 版本 | 文件大小 | VMAF 均值 | 首帧时间 |
| --- | ---: | ---: | ---: |
| 原片 H.264 / MP4 | 2.53 MB | — | 796 ms |
| 上一版 VP9 / WebM | 1.11 MB | 96.16 | 612 ms |
| H.264 / MP4 兼容版 | 1.17 MB | 96.51 | 614 ms |
| AV1 / WebM 对照版 | 1.36 MB | 97.26 | — |

WebM 采用 VP9 的屏幕内容模式、CRF 36 和 8 位 `yuv420p`，索引置于文件前部。MP4 版用 H.264 CRF 23 和 `faststart`。两版均有章节时间轴。 [GitHub 支持的媒体格式](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files#image-and-media-files) · [WebKit 的 WebM 支持](https://webkit.org/blog/15063/webkit-features-in-safari-17-4/#media)
