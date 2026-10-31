# GitHub Studio source synchronization — 31 October 2026

Owner explicitly requested synchronization to https://github.com/quocanh38/dual-dictionary.

## Source and scope

- Source application: deployment worktree at commit `dddf30818`, including v151 Studio UI and separately updated 31 October submission documents. This is a source export, not a merge of deployment history.
- Existing public main parent: `2c43d65feb5f48c67568396898fc9d1ba4c2a77c`; history preserved, no forced update.
- Complete runtime application/assets, 33 approved library packs, test/build tools, structured generation/review/QA evidence and updated dossier are included.
- Outdated root application copies from the older public layout are replaced by the current js/css/samples layout. Updated third-party attribution is retained as NOTICE.md.
- Workstation handoffs, AGENTS instructions and QA PNG screenshots are excluded. Historical screenshot references may therefore be unavailable. Local provider credentials, browser state, study backups, video working files and deployment history are not exported.
- No new provider generation, content editing, approval, production deployment or hackathon submission is performed.

## Verification

- Credential-pattern scan of candidate file bytes: one fixed dummy credential fixture in `tools/lessons/batch-input-check.mjs`; no real credential detected. JSON sensitive-field scan returned no populated credential fields.
- Original runtime files are copied byte-for-byte; no application logic or pack payload is edited for publication.
- Schema/generator contracts: 27 groups PASS.
- Library integrity and explicit-fetch-failure contracts: PASS.
- Quality-gate contracts including explicit approval and edit invalidation: PASS.
- Current full library: all 33 envelope checksums/metadata verified against the index.
- No new browser/device or language-quality certification is implied. Earlier observed browser flow is recorded separately in STUDIO-DEMO-2026-10-31.md.

The hosted three-minute video URL, owner survey answers and final submission remain separate outstanding steps.

## Publication receipt

GitHub main was successfully updated to [58ef314a4ccae9b05f449376e25678bd5b7ef2b6](https://github.com/quocanh38/dual-dictionary/commit/58ef314a4ccae9b05f449376e25678bd5b7ef2b6). Remote commit and complete tree were verified after push. Runtime byte parity passed for 18,431 files. The Netlify deployment remote was not pushed.
