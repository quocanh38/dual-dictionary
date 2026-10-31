# Submission form — review-ready text, 31 October 2026

Draft only. The public GitHub source snapshot includes Studio and the current dossier. The hosted video URL remains missing. The two opinion/intent surveys and legal consent require the owner's own answers/decision. No form has been filled or submitted by this update.

## Project description

Dual Dictionary helps Vietnamese learners turn a reading into phrases they can use. Our new Offline Lesson Studio takes an original or permitted text, uses Meta models to draft source-grounded phrases and bilingual exercises, and separates editorial review from publication. A learner installs an approved, versioned pack once, then reads, practises with explanations, writes in a new situation, and saves the selected meaning and source to the existing Vault—even offline, without an API key.

The pre-event foundation already included the dictionary, Reader, Vault and live Tutor. Hackathon work beginning 27 October adds the Studio authoring/review/player workflow, versioned offline packs, isolated draft/progress storage and exact-meaning integration. The library contains 33 AI-assisted, editor-reviewed packs. Review and deterministic checks do not certify teaching quality; learner outcomes have not been measured.

## Describe use of Meta products

Meta models perform phrase selection, contextual EN/VI meaning drafting, exercise/answer-explanation generation and changed-situation writing-task creation. Retained pack metadata names the actual provider/model used; for example the demo lesson records Meta Model API / muse-spark-1.3 from 27 October, followed by separately recorded editorial work and AI-assisted cross-review.

The current author interface routes new generation through Baseten-hosted Muse Spark Open and offers one explicit Meta Model API repair. Each request exposes source sentences, instructions, provider and model before consent. No output is automatically approved. Review covers meanings, all answer alternatives, explanations and transfer; approved payloads are installed as immutable pack versions. The main demo uses clearly labelled retained material and makes no new generation call.

## Why Meta's models matter

They supply the language-generation step needed to turn a permitted reading into a bilingual lesson draft, rather than requiring a person to write every phrase explanation and exercise from scratch. Our product adds an inspectable boundary around that generation: source grounding, failure records, editorial corrections, explicit approval and an offline package that can be reused without another API call. We have not established comparative superiority over other models or measured learning gains.

## Optional partner feedback

Draft for owner review: The Studio creation route uses Baseten-hosted Muse Spark Open. We expose its destination/model and retain request outcomes instead of silently retrying. Provider processing still needs connectivity and an owner-supplied key; learner practice is separated into installed offline packs. Add only feedback supported by actual experience; no latency, cost or reliability claim is supplied here.

## URLs and owner decisions

- Public GitHub repository URL: https://github.com/quocanh38/dual-dictionary
- Source readiness: Studio code, 33 reviewed packs, test/build tools and the current dossier are included; prior public repository history is preserved.
- Main three-minute video viewing URL: pending; local final file is DualDictionary-Studio-demo-3min.mp4.
- Track/theme currently observed: Indie Developer / Build for Your World; owner to confirm.
- Likelihood of building with Meta Model API: owner answer required.
- Overall opinion of Meta Model API: owner answer required.
- Final permission checkbox and Submit: owner review at submission time.
