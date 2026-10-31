# Hero demo script — the 2-minute loop (Reader → phrases → new situation → Vault)

Goal: answer "What can Meta AI do that dictionary + flashcards + generic chatbot cannot?"
in one visible loop. All AI steps need internet + your own key; offline lesson path is
the fallback when no key is present.

## Setup (before the clock)
- Clear a short paragraph (~80–150 words) containing "take off" in one clear sense,
  e.g. "Our flight took off twenty minutes late…" (cất cánh).
- In Advanced → Learning, Save & test connection (small paid request). Keep the
  fallback ready: "Start a free offline lesson (no key)".

## The 120 seconds
1. **0:00–0:20 Read** — paste the paragraph, Start reading. Point at the coverage line:
   it is an estimate ("within estimated coverage"), plus the 3-color highlight.
2. **0:20–0:45 Pick in context** — AI practice → 3 phrases grounded in the article.
   Note cached-vs-live labels; no Vault change yet.
3. **0:45–1:15 Answer wrong on purpose** — choose "take off", answer with an error
   ("We will carries out research…" style or "I careful practice…"). Request feedback
   with consent shown.
4. **1:15–1:45 Quoted feedback** — show the exact quote, the one correction, and the
   Vietnamese explanation. Accept or reject explicitly.
5. **1:45–2:00 Save** — save the phrase to Vault for FSRS review. End line:
   "Dictionary told me the meaning; the loop taught me to use it."

## If the key fails on stage
- The error stage now shows Retry + Open AI settings + Cancel with the hint that
  retrying the same settings will likely fail again.
- Open AI settings, fix key/model, Save & test connection, then retry. If still
  blocked, switch to the offline lesson — never fake a live result.
