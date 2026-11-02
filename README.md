# localreel-web

The LocalReel web UI (React 18 + TypeScript + Vite): Library, Reels, Player and
Admin against the `localreel-core` API at `/api/v1`.

The UI is bilingual (Simplified Chinese / English). Every page has a 中文 / EN
switch; the first visit follows `navigator.language` and the choice is stored in
`localStorage` under `localreel.lang`. Strings live in `src/i18n.ts` as two flat
dictionaries whose key sets are enforced at compile time (`TranslationKey`) and
by `src/i18n.test.ts`.

## Develop

Start the development server first (it is isolated from an installed release:
port 3101, data in `.dev-data/`):

```powershell
cd ..\localreel-core
.\scripts\dev.ps1
```

Then:

```powershell
npm install
npm run dev
```

Vite proxies `/api`, `/thumbnails` and `/transcodes` to `127.0.0.1:3001`.

## Build

```powershell
npm run build
```

`dist/` is consumed by the server as static assets in a later phase.

## Browser resume test

With a server running against a library that has a saved position > 5s:

```powershell
$env:LOCALREEL_BASE_URL = 'http://127.0.0.1:3317'
$env:CHROME_PATH = 'C:\...\chrome.exe'
npm run test:resume
```

The script launches headless Chromium with the DevTools Protocol, opens
`/watch`, and asserts the first Reels `<video>.currentTime` is within 3s of the
saved position.

## License

Apache-2.0 — see [`LICENSE`](LICENSE). Copyright 2026 LocalReel contributors.
