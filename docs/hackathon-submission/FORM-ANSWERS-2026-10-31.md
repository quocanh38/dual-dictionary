# Submission form — review-ready text, 31 October 2026

Submitted field reference; final submission verified 1 November 2026 at 09:39 Vietnam. The public GitHub source snapshot includes Studio and the current dossier. Video published: https://youtu.be/6r8nJDiZr5E. Required project fields and owner-selected surveys were filled on 1 November 2026; owner completed legal consent and final Submit; verified via the submission-specific edit page.

## Project description

Dual Dictionary helps Vietnamese working adults turn a reading into phrases they can use on the job. Our new Offline Lesson Studio takes an original or permitted text, uses Meta models to draft source-grounded phrases and bilingual exercises, and separates editorial review from publication. A learner installs an approved, versioned pack once — workplace handovers, deliveries, safety plans, academic readings — then reads, practises with explanations, writes in a new situation, and saves the selected meaning and source to the existing Vault: even offline, without an API key. Built for shifts, sites and commutes where the network drops.

The pre-event foundation already included the dictionary, Reader, Vault and live Tutor. Hackathon work beginning 27 October adds the Studio authoring/review/player workflow, versioned offline packs, isolated draft/progress storage and exact-meaning integration. The library contains 33 AI-assisted, editor-reviewed packs. Review and deterministic checks do not certify teaching quality; learner outcomes have not been measured.

## Describe use of Meta products

Meta models perform phrase selection, contextual EN/VI meaning drafting, exercise/answer-explanation generation and changed-situation writing-task creation. All 33 library packs record Meta Model API / muse-spark-1.3 in hash-bound generation metadata, shown under every pack. The demo lesson is one of them (27 October), followed by separately recorded editorial work and AI-assisted cross-review.

The current author interface routes new generation through Baseten-hosted Muse Spark Open (`meta-models/muse-spark-open-1026`) and offers one explicit Meta Model API repair with reasoning on. A new experimental photo path lets Meta vision transcribe a printed notice the author has the right to use (100+ legible characters or rejected) into a reading draft that walks the same selection/review/approval road. The main-app Tutor defaults to Meta Model API / muse-spark-1.3. Each request exposes source sentences, instructions, provider and model before consent; outcomes land in an exportable usage ledger. No output is automatically approved. The main demo uses clearly labelled retained material and makes no new generation call. Live demo: the Studio Why-Meta page names every route with its model.

## Why Meta's models matter

They supply the language-generation step needed to turn a permitted reading — typed or photographed — into a bilingual lesson draft, rather than requiring a person to write every phrase explanation and exercise from scratch. The Muse Spark family covers the whole author road: creation (Muse Spark Open), repair with reasoning (Meta Model API) and the new vision transcription path. Our product adds an inspectable boundary around that generation: source grounding, failure records, editorial corrections, explicit approval and an offline package that can be reused without another API call. We have not established comparative superiority over other models or measured learning gains.

## Optional partner feedback

Draft for owner review: The Studio creation route uses Baseten-hosted Muse Spark Open; repair and the experimental photo transcription use Meta Model API with reasoning. We expose every destination/model and retain request outcomes instead of silently retrying. Provider processing still needs connectivity and an owner-supplied key; learner practice is separated into installed offline packs. Add only feedback supported by actual experience; no latency, cost or reliability claim is supplied here.

## URLs and owner decisions

- Public GitHub repository URL: https://github.com/quocanh38/dual-dictionary
- Source readiness: Studio code, 33 reviewed packs, test/build tools and the current dossier are included; prior public repository history is preserved.
- Main three-minute video viewing URL: https://youtu.be/6r8nJDiZr5E — Unlisted, English captions, 1080p available; player displays 3:00.
- Track/theme currently observed: Indie Developer / Build for Your World; owner to confirm.
- Likelihood of building with Meta Model API: Very likely — explicitly selected by owner on 1 November; entered into form.
- Overall opinion of Meta Model API: Very favorable — explicitly selected by owner on 1 November; entered into form.
- Final permission checkbox and Submit: owner completed; verified 1 November 2026 at 09:39 Vietnam.
