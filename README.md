# localreel-web

The LocalReel web UI: React 18 + TypeScript + Vite, served by the
`localreel-core` server at `/api/v1`.

## Features

- **Library** — paginated grid with search, filters (all / continue / favourites
  / archived), metadata and thumbnails.
- **Reels** — a vertical feed over the same library: ranked by the server
  (continue-watching first, then unwatched episodes), autoplay of the next
  episode, swipe navigation, double-tap like, long-press on the right side for
  2× (release restores 1×), draggable progress bar, and a fullscreen button for
  landscape video.
- **Player** — resume from the saved position, progress saved on pause, tab
  hide, page hide and item change; error states with retry.
- **Admin** — sources, scan history and issues, jobs with cancel, cache stats
  and GC, backup/restore.
- **Bilingual UI** — English and Simplified Chinese on every page. The first
  visit follows `navigator.language`; a small globe button switches language and
  the choice is stored in `localStorage` under `localreel.lang`.
- **PWA** — manifest and icons, so the UI can be added to a phone home screen
  and opens standalone.

Strings live in `src/i18n.ts` as two flat dictionaries whose key sets are
enforced at compile time (`TranslationKey`) and by `src/i18n.test.ts`.

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

Vite proxies `/api`, `/thumbnails` and `/transcodes` to the server on 3101; set
`VITE_API_TARGET` to point elsewhere.

## Build and test

```powershell
npm run build   # tsc (strict) + vite build -> dist/
npm test        # resume, i18n and feed helpers
npm run test:browser   # headless Chrome resume smoke against a mock API
```

`dist/` is the build-time input the server embeds into its binary.

## Where this fits

This repository is a **component**: it produces static assets. Installers,
downloads and the composed product live in the
[`LocalReel`](https://github.com/LocalReel/LocalReel) product repository.

## License

Apache-2.0 — see [`LICENSE`](LICENSE). Copyright 2026 LocalReel contributors.

---

## 简体中文

LocalReel 的 Web 界面：React 18 + TypeScript + Vite，由 `localreel-core` 服务器
在 `/api/v1` 上提供。

- **媒体库**：分页网格，支持搜索、筛选（全部 / 继续观看 / 收藏 / 已归档）、
  元数据与缩略图。
- **短视频流（Reels）**：同一媒体库的竖向 feed，由服务端排序（续播优先、未看
  剧集其次），自动连播下一集，支持上下滑、双击点赞、右侧长按 2 倍速（松手恢复）
  与可拖动进度条；横屏视频提供全屏观看按钮。
- **播放器**：从上次位置续播；暂停、切换标签页、关闭页面与切集时保存进度；出错
  时提供重试。
- **管理页**：来源、扫描历史与问题、可取消的任务列表、缓存统计与回收、
  备份/恢复。
- **双语界面**：每个页面支持英文与简体中文；首次访问跟随浏览器语言，右上角
  小地球按钮切换并记住选择。
- **PWA**：包含 manifest 与图标，可添加到手机主屏并以独立窗口打开。

开发：先在 `localreel-core` 运行 `.\scripts\dev.ps1`（端口 3101），再在本仓库
执行 `npm install` 与 `npm run dev`。构建与测试：`npm run build`、`npm test`、
`npm run test:browser`。

本仓库是组件，产物（安装包、下载）在产品仓库
[`LocalReel`](https://github.com/LocalReel/LocalReel)。
