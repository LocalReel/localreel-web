# localreel-web

The LocalReel web UI (React 18 + TypeScript + Vite).

This repository is intentionally a thin shell for now: it talks to the
`localreel-core` API at `/api/v1` and will be ported feature-by-feature from
the previous LocalReel UI (library, feed, player, admin).

## Develop

Start the server first:

```powershell
cd ..\localreel-core
cargo run -p localreel-server -- serve
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

TBD by the repository owner.
