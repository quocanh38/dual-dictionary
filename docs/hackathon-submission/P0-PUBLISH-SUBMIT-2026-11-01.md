# P0 publication and submission record — 1 November 2026

## Completed

- Owner confirmed upload/publication to YouTube Unlisted, including YouTube upload terms.
- Main Studio video: [https://youtu.be/6r8nJDiZr5E](https://youtu.be/6r8nJDiZr5E), channel Nguyen Quoc Anh, uploaded by agent on behalf of owner. Original SHA-256: `aa09906d1f446abd4df04e090de64bb087b9e573bb0d0ae01fa1a4c4f1cb079d`.
- English SRT uploaded and visible in the caption editor; English captions available to signed-out viewers. 1080p option available, signed-out player decoded 1920×1080, watch duration displays 3:00; DOM media duration 180.021s. Studio thumbnail rounds to 3:01.
- Public GitHub URL, video URL, project description, use of Meta and why Meta fields filled in the authenticated form. Track/theme remain Indie Developer / Build for Your World.
- Owner expressly chose Very likely and Very favorable; both selected. The agent left additional optional survey groups unanswered; owner later completed them before submitting.
- Official Meta schedule rechecked 1 November: 4 November 21:00 ET = 5 November 09:00 Vietnam. Owner target remains submission before evening 4 November Vietnam.

## Submission completed; remaining physical proof

- Submitted by the owner on 1 November 2026; verified at 09:39 Vietnam (02:39 UTC) when the authenticated portal changed to Your Submission / Update Project with a submission-specific ID and consent checked. This is the verification time, not a claimed exact server submission timestamp.
- Physical phone airplane-mode proof has not been recorded or provided. The main demo remains Chrome Offline emulation, not physical airplane mode.
- Remote documentation publication/deployment results are recorded in the local publication receipt and deployment log after checks complete.

No pack payload, new generation or content approval is changed. Post-deploy browser smoke found a pre-existing blocking JavaScript syntax error from the v157 Reader translation edit. This P0 fix removes a duplicated comma and restores a missing property separator; service-worker cache advances v153 to v154 so clients receive the corrected app.

## Prepublication checks

Signed-out playback reached the end (180.021s) at 1920×1080 with the player unmuted. The original file decodes completely with both video/audio streams. This is not a claim of an independent human listening review. Full Netlify baseline verification passed: no live-only or unexplained baseline drift. Link check passed over 11,172 HTML pages after recognizing the existing `#studio` and `#practice` SPA routes; blog scan passed with pre-existing title-length warnings. Runtime precache assets are unchanged, so no cache bump is needed. Scratch adapters used the already-installed official Netlify CLI because npx is unavailable; no app/tool source was changed.

## Blocking app syntax issue found by smoke

The first documentation publication deployed successfully as `6ae6a4c1528dcf255fa8bfa3` at 2026-11-01T02:33:03.264Z (source `90aba15e78a4b2a46b86ac714819b955e60278e5`). HTTP checks were 200, but browser smoke exposed the pre-existing app syntax error. Therefore HTTP success was not treated as a passing functional smoke. The minimal punctuation/cache fix is verified separately before claiming completion.

Local hotfix verification: node syntax checks for js/app.js and sw.js passed. A localhost browser session initialized the main app, completed onboarding and opened Reader with the loop hint; no console errors were observed. No model calls or lesson changes were made.

## Final receipt

Submitted by the owner on 1 November 2026; verified at 09:39 Vietnam (02:39 UTC) when the authenticated portal changed to Your Submission / Update Project with a submission-specific ID and consent checked. This is the verification time, not a claimed exact server submission timestamp.

- Submission ID: `14abd9e6-3945-4fe3-bed7-8c32e600375a`. The authenticated page shows Your Submission, disabled team name and an Update Project action, rather than the original Submit form. Owner reported “đã submit”; the agent did not press the contest Submit button.
- Main video submitted: https://youtu.be/6r8nJDiZr5E. Physical phone proof is still pending; it is not represented as completed.
- v160 hotfix deploy: `6ae6a585fd8e4f55e34cda5d`, source `5d9570762a9693a23ff995b3f066c2d55579c16c`, published 1 November at 09:36:19 Vietnam. Cache `mdx-dict-v154`.
- Live app.js SHA-256 matched local: `8aa0af0e8df1a0da054d46e1f7b375b3f1a9f2660901c458f5b2f9f1dade1d99`. Full post-deploy parity passed; HTTP smoke 10/10 passed. Final browser smoke 7/7 returned populated pages with no console errors, and production Reader opened successfully.
- One previously cached production session initially retained the old syntax error. Visiting Studio refreshed its service worker; a subsequent production session worked without clearing learning data. The cold deploy URL also initialized successfully.
- Local receipt screenshots and submitted-field snapshot are kept in the owner's outputs directory rather than published with personal form details.

## Subsequent emulated supplement

Owner requested a separately published `mobile-emulation supplement`: https://youtu.be/IIomKgrVzmw (Unlisted, 30 seconds). The dossier explicitly describes browser/device emulation; this does not close the pending physical-phone proof item. The existing contest submission and its main demo URL were not modified.
