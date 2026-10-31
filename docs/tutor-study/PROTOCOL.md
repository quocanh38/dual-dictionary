# Tutor study and demo protocol

Status: prepared; no participants recruited and no user results collected by this change.

Recruit 5–8 consenting Vietnamese adults who read English but want to use phrases more naturally. The owner recruits participants; no messages have been sent on their behalf. Assign anonymous IDs P01–P08. Keep names, keys and contact details out of exports and the repository. Store answers only with the participant's agreement. No automatic analytics or uploads.

For each participant, use two short, permitted articles with comparable phrases. Alternate which article is studied through dictionary lookup and which through Tutor. Record whether each flow completed without help, each interruption, time spent, and whether feedback was useful. Ask for a new situation using the phrase immediately and again about 24 hours later. Have a proficient English reviewer judge both responses without seeing which method was used. Report counts, missing follow-ups and errors; this small study cannot establish general effectiveness.

## Session record (copy per participant)

- Anonymous ID:
- Consent to local collection: yes / no
- Study date and follow-up due time:
- Order: dictionary first / tutor first
- Article and phrase IDs:
- Model/provider and live or cache label:
- Completed without help: yes / no
- Duration:
- Feedback useful: yes / no / unsure
- Exact misleading correction, if any:
- Immediate new-context answer and reviewer judgment:
- 24-hour answer and reviewer judgment:
- Missing follow-up and reason, if volunteered:

## Release checks

Run the live BYOK flow in the browser: source phrase → situation → answer → verified quote → accept/reject → retry → Vault. Record provider/model and timestamp, without keys. Test reload at each stage, draft recovery, cancel, double clicks, timeout, invalid JSON, wrong quotes, rejected feedback, repeat saves, migration of an existing v4 database, JSON/encrypted backup restoration and deletion. Confirm no AI feedback operation changes FSRS grades. Confirm dictionary, Vault and review still work offline. Check narrow phone view, keyboard navigation and dialog focus. Mark each result PASS/FAIL/NOT RUN with evidence; never infer PASS from source inspection.

## Video storyboard (about 2:30, adapt to final rules)

00:00–00:15: learner problem and free offline core.
00:15–00:40: article, grounded phrases, local due/error ranking.
00:40–01:15: actual live Meta request, learner answer, quoted correction.
01:15–01:40: accept/reject and a different situation.
01:40–02:00: Vault, reload and offline review.
02:00–02:20: real study results, sample size and limitations; omit results until collected.
02:20–02:30: architecture and exact work built during hackathon.

Label live calls, previously captured cache and authored sample data separately. The guided sample at demo/tutor.html is authored, not a captured AI result. Record a live Meta flow only after configuring a current key in app settings and checking current model access/CORS. Never film a key. Freeze a baseline and document pre-existing code separately once official contest rules clarify eligible work.
