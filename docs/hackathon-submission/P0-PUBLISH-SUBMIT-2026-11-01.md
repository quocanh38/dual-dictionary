# P0 publication and submission record — 1 November 2026

## Completed

- Owner confirmed upload/publication to YouTube Unlisted, including YouTube upload terms.
- Main Studio video: [https://youtu.be/6r8nJDiZr5E](https://youtu.be/6r8nJDiZr5E), channel Nguyen Quoc Anh, uploaded by agent on behalf of owner. Original SHA-256: `aa09906d1f446abd4df04e090de64bb087b9e573bb0d0ae01fa1a4c4f1cb079d`.
- English SRT uploaded and visible in the caption editor; English captions available to signed-out viewers. 1080p option available, signed-out player decoded 1920×1080, watch duration displays 3:00; DOM media duration 180.021s. Studio thumbnail rounds to 3:01.
- Public GitHub URL, video URL, project description, use of Meta and why Meta fields filled in the authenticated form. Track/theme remain Indie Developer / Build for Your World.
- Owner expressly chose Very likely and Very favorable; both selected. Additional survey groups have no aria-required flag and are left unanswered.
- Official Meta schedule rechecked 1 November: 4 November 21:00 ET = 5 November 09:00 Vietnam. Owner target remains submission before evening 4 November Vietnam.

## Pending; do not mark complete without evidence

- Owner must review team/eligibility, accept the final materials-use permission and press Submit. No success receipt has been observed yet. No submission time is claimed.
- Physical phone airplane-mode proof has not been recorded or provided. The main demo remains Chrome Offline emulation, not physical airplane mode.
- Remote documentation publication/deployment results are recorded in the local publication receipt and deployment log after checks complete.

No pack payload, new generation or content approval is changed. Post-deploy browser smoke found a pre-existing blocking JavaScript syntax error from the v157 Reader translation edit. This P0 fix removes a duplicated comma and restores a missing property separator; service-worker cache advances v153 to v154 so clients receive the corrected app.

## Prepublication checks

Signed-out playback reached the end (180.021s) at 1920×1080 with the player unmuted. The original file decodes completely with both video/audio streams. This is not a claim of an independent human listening review. Full Netlify baseline verification passed: no live-only or unexplained baseline drift. Link check passed over 11,172 HTML pages after recognizing the existing `#studio` and `#practice` SPA routes; blog scan passed with pre-existing title-length warnings. Runtime precache assets are unchanged, so no cache bump is needed. Scratch adapters used the already-installed official Netlify CLI because npx is unavailable; no app/tool source was changed.

## Blocking app syntax issue found by smoke

The first documentation publication deployed successfully as `6ae6a4c1528dcf255fa8bfa3` at 2026-11-01T02:33:03.264Z (source `90aba15e78a4b2a46b86ac714819b955e60278e5`). HTTP checks were 200, but browser smoke exposed the pre-existing app syntax error. Therefore HTTP success was not treated as a passing functional smoke. The minimal punctuation/cache fix is verified separately before claiming completion.

Local hotfix verification: node syntax checks for js/app.js and sw.js passed. A localhost browser session initialized the main app, completed onboarding and opened Reader with the loop hint; no console errors were observed. No model calls or lesson changes were made.
