# Isolated browser regression gates

Run `npm ci`, then `npm run build` before browser tests. Requires Node.js 22.13+ (ESLint 10's minimum on the Node 22 release line) and Chrome/Chromium/Edge; set `CHROME_PATH` if not installed in one of the detected standard locations.

- `npm run typecheck`: application type checking without output.
- `npm run typecheck:test`: strict type checking of every `src/**/*.test.ts`, including imported source, with explicit Node 22 types. The test config intentionally clears the application config's test exclusion.
- `npm run lint`: ESLint flat config, TypeScript recommended correctness rules and React Hooks rules; warnings fail CI. No formatting/style rewriting is required.
- `npm test`: pure unit tests, including stale request completion/failure fencing.
- `npm run test:watch`: delayed playback preparation, conditional video mounting, saved-position resume, timeupdate UI, state flush, button keyboard handling, dialog focus stability, SPA media switch with a different resume position, and media-error retry UI.
- `npm run test:browser`: Reels saved-position playback smoke.
- `npm run test:admin`: mocked administrator/plugin page smoke.
- `npm run test:hls`: isolated hls.js/MSE playback and segment requests. Uses the statically linked `ffmpeg-static` dev dependency (override with `FFMPEG_PATH`), so no system packages are needed. Generates a short HLS fixture in a unique temporary directory. Native HLS detection is disabled in this test so the dynamically loaded hls.js path is exercised.

The mock scripts serve the built `dist` on an ephemeral loopback port, use only synthetic API state and fixtures, and create a separate temporary browser profile. They do not connect to a real LocalReel server or modify a media library. Generated HLS fixtures and browser profiles are removed at shutdown. CI runs build plus all four browser gates, installing ffmpeg for HLS.

The legacy `browser-hls-test.mjs` and `browser-resume-test.mjs` scripts target a real server and are **not** used by these gates. Do not point legacy scripts at a production library.

Dependency audit note (2026-11-11): the locked ESLint 10 / typescript-eslint 8 toolchain transitively uses minimatch 10.2.6, affected by moderate GHSA-g3hv-75wg-m249 (glob-pattern resource amplification). This is dev tooling processing repository-controlled patterns, not a shipped runtime dependency. No unsupported cross-major override or forced downgrade was applied. Track upstream fixes; do not claim the full dev dependency audit is clean. `npm audit --omit=dev` is a separate runtime-only check.

These smoke tests are not a complete browser/accessibility matrix. iOS fullscreen behavior, small-screen layouts, and clipboard restrictions on real LAN HTTP remain manual checks.
