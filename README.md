# localreel-web

The LocalReel web UI: React 18 + TypeScript + Vite, served by the
`localreel-core` server under `/api/v1`.

Component version: **0.5.8** (release preparation). This update repairs player
lifecycle and cross-item resume, fences stale cache responses, and improves
keyboard/focus and playback-error handling. Release checks include lint,
application/test type checking, and isolated Watch/HLS browser regressions.

## What it is

- **Home** (`/`) — continue watching, shows, recently added.
- **Library** (`/library`) — every file, searchable and filterable.
- **Show** (`/show/:id`) — the episodes the scanner grouped under one folder,
  with a single "continue" action.
- **Watch** (`/watch/:id`) — the player, with audio tracks, HLS repackaging,
  progress-bar previews, resume, and the share dialog.
- **Reels** (`/reels`) — a vertical, snap-scrolling feed ranked by the server.
- **Plugins** (`/plugins`, `/plugins/:id`) — a top-level module, not a console
  tab: installed packages with the icon their manifest declares, capabilities
  per version, secrets, logs and the package audit.
- **Shared item** (`/s/:token`) — the one page rendered **outside** the sign-in
  gate, because the people opening a share link do not have an account here. It
  talks to one endpoint and plays one file.
- **Console** (`/admin` and nine sub-pages) — health, sources, accounts and
  sessions, jobs, scans, cache, backup, audit and settings.
- **First run / sign-in** — a gate in front of every page except `/s/:token`.

Routing is a small history router (`src/app/match.ts` + `router.tsx`); the
server answers any unmatched HTML path with the shell, so every URL survives a
reload and can be shared.

## Two runtime dependencies, on purpose

`react`, `react-dom` and a lazily imported `hls.js`. There is no router
package, no query library and no component framework: the router is ~150 lines
of pure matching code, the query cache is ~180 lines with dedupe and prefix
invalidation, and the component primitives are in `src/ui/`. Everything that is
a pure function has a `node --test` suite, which keeps the tests free of a DOM.

## Design system

- **Tokens** live in `src/ui/tokens.css`: primitives → semantic names →
  themes. Components never contain a hex colour, a pixel font size or a magic
  radius.
- **Default theme** is dark ("screening room", tungsten accent). A light theme
  and three alternative accents exist as token overrides; the console's
  Settings page switches between them and the choice is stored in this browser
  (`localStorage["localreel.ui"]`).
- **Type**: Newsreader for Latin display, IBM Plex Sans for UI, IBM Plex Mono
  for server-owned strings. All three are self-hosted under `src/fonts/`
  (SIL OFL 1.1) because the server's CSP is `font-src 'self'`. CJK glyphs fall
  through to an explicit `Noto Sans SC / PingFang SC / Microsoft YaHei` stack.
- **Density** is a data attribute (`comfortable` / `compact`); the console uses
  it to tighten tables without changing the browsing surfaces.

## Bilingual

Every string lives in `src/i18n/dict.en.ts` (the source of truth) and
`src/i18n/dict.zh.ts`. `TranslationKey` is derived from the English dictionary,
so a missing key fails `tsc`; `src/i18n/i18n.test.ts` additionally checks key
sets, placeholder sets and empty values at runtime.

## Develop

Start the API server first (isolated from an installed release: port 3101, data
in `.dev-data/`):

```powershell
cd ..\localreel-core
.\scripts\dev.ps1
```

Then:

```powershell
npm install
npm run dev
```

Vite proxies `/api`, `/thumbnails`, `/transcodes`, `/previews`, `/posters` and
`/hls` to the server on 3101. Set `VITE_API_TARGET` to point elsewhere.

## Build and test

Use Node.js 22.13+ on the 22.x line, or Node.js 24+. See
[isolated test setup and dependency-audit notes](scripts/TESTING.md).

```powershell
npm run lint
npm run typecheck
npm run typecheck:test
npm run build          # tsc (strict) + vite build -> dist/
npm test               # router, cache, i18n, feed, format, preview, resume, text
npm run test:browser   # headless Chrome resume smoke against a mock API
npm run test:watch     # conditional mount, progress, media switch, focus and errors
npm run test:hls       # isolated hls.js/MSE fixture; requires ffmpeg
```

`dist/` is the build-time input the server embeds into its binary, so it must
exist before `cargo build` in `localreel-core`.

## Accessibility

Every control is a real button or link, the focus ring is one global
`:focus-visible` treatment, dialogs trap focus and return it, the console has a
skip link, dialogs use `aria-modal`, tabs implement the arrow-key contract, and
every colour pair in the default and light themes was measured against WCAG AA
(text ≥ 4.5:1, large text ≥ 3:1).

## Where this fits

This repository is a **component**: it produces static assets. Installers,
downloads and the composed product live in the
[`LocalReel`](https://github.com/LocalReel/LocalReel) product repository.

## License

Apache-2.0 — see [LICENSE](LICENSE). Copyright 2026 LocalReel contributors.
Bundled typefaces are licensed under the SIL Open Font License; see
`src/fonts/OFL-*.txt`.

---

## 简体中文

LocalReel 的 Web 界面：React 18 + TypeScript + Vite，由 `localreel-core` 服务器
在 `/api/v1` 上提供。

组件版本：**0.5.8**（发布准备中）。本次修复播放器生命周期与跨集续播、缓存旧请求
覆盖、键盘与焦点交互及播放错误反馈；发布门禁包含 lint、应用与测试类型检查，以及
隔离的 Watch/HLS 浏览器回归。

- **首页**（`/`）：接着看、作品、最近入库。
- **媒体库**（`/library`）：按文件列出全部条目，可搜索、可筛选。
- **作品**（`/show/:id`）：同一目录下被归并的剧集，附一个"继续播放"动作。
- **播放**（`/watch/:id`）：音轨、HLS 重封装、进度条预览、续播，以及分享对话框。
- **短视频**（`/reels`）：服务端排好序的竖向流。
- **插件**（`/plugins`、`/plugins/:id`）：左侧一级模块，不再是控制台的一个标签页；
  列出已安装的包与清单声明的图标、按版本授权的能力、密钥、日志与包审计。
- **分享页**（`/s/:token`）：唯一渲染在登录门**之外**的页面——打开分享链接的人
  在这台服务器上没有账户。它只问一个接口、只播一个文件。
- **管理**（`/admin` 及九个子页）：运行状态、来源、账户与会话、任务、扫描、缓存、
  备份、审计与设置。
- **首次设置 / 登录**：除 `/s/:token` 之外所有页面之前的一道门。

导航使用自带的 history 路由；服务端对任何未匹配的 HTML 路径返回同一个壳，
因此每个地址都能刷新、能分享。

## 只有两个运行时依赖

`react`、`react-dom`，以及按需 `import()` 的 `hls.js`。没有路由库、没有查询库、
没有组件框架：路由是约 150 行纯匹配函数，查询缓存约 180 行（去重 + 前缀失效），
组件原语在 `src/ui/`。所有纯函数都有 `node --test` 用例，测试不依赖 DOM。

## 设计系统

- 令牌在 `src/ui/tokens.css`，分原始层、语义层、主题层。组件里不出现色值、
  像素字号或随手写的圆角。
- 默认是深色（"放映室"，钨丝强调色）；另有浅色主题与三种备选强调色，都是令牌
  覆盖。控制台「设置 → 外观」可切换，选择存在本浏览器。
- 字体：拉丁标题 Newsreader、界面 IBM Plex Sans、服务端字符串 IBM Plex Mono，
  全部自托管（SIL OFL 1.1），因为服务端 CSP 是 `font-src 'self'`。中日韩字形
  落到显式的 `Noto Sans SC / PingFang SC / Microsoft YaHei` 栈。
- 密度是 data 属性（舒适 / 紧凑），只影响控制台的表格。

## 双语

所有文案在 `src/i18n/dict.en.ts`（事实来源）与 `dict.zh.ts`。`TranslationKey` 由
英文字典推导，缺键直接编译失败；`i18n.test.ts` 另外校验键集、占位符集合与空值。

## 开发与构建

使用 Node.js 22.13+（22.x）或 24+；执行 `npm run lint`、`npm run typecheck`、
`npm run typecheck:test` 检查代码与测试。浏览器回归和依赖审计注意事项见
[测试说明](scripts/TESTING.md)。

先在 `localreel-core` 运行 `.\scripts\dev.ps1`（端口 3101），再在本仓库执行
`npm install` 与 `npm run dev`。构建与测试：`npm run build`、`npm test`、
`npm run test:browser`。

`dist/` 是服务端编译期嵌入的输入，因此必须在 `cargo build` 之前生成。

## 无障碍

控件都是真实的 button / link；焦点样式统一为全局 `:focus-visible`；对话框会锁住
焦点并在关闭后归还；控制台有跳转链接；标签页实现方向键约定；默认主题与浅色主题
的配色都按 WCAG AA 实测（正文 ≥ 4.5:1，大字 ≥ 3:1）。

本仓库是组件，产物（安装包、下载）在产品仓库
[`LocalReel`](https://github.com/LocalReel/LocalReel)。
