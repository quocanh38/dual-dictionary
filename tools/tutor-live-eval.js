import { TUTOR_FEEDBACK_INSTRUCTIONS } from '../js/tutor-prompts.js';
import { askTutor, getAiSettings, PROVIDERS } from '../js/ai-client.js';
import { validateTutorFeedback } from '../js/tutor-validation.js';
import { LIVE_EVAL_CASES as cases, summarizeLiveEvalResults } from './tutor-live-eval-cases.js';

const results = new Map();
const controllers = new Map();
let runGeneration = 0;
const $ = (selector, root = document) => root.querySelector(selector);
const statusEl = $('#eval-settings');
const caseRoot = $('#eval-cases');
const exportButton = $('#eval-export');

function settingsLabel() {
  const s = getAiSettings();
  if (!s.apiKey) return 'Chưa có API key trong profile này. Cấu hình key trong app trước khi chạy live; chưa có yêu cầu nào được gửi.';
  return `Đã cấu hình ${PROVIDERS[s.provider]?.label || s.provider} / ${s.model}. Key không hiển thị trong công cụ.`;
}

function addText(parent, tag, text, className = '') {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  parent.appendChild(el);
  return el;
}

function makeCaseCard(testCase) {
  const card = document.createElement('article');
  card.className = 'eval-case';
  card.dataset.caseId = testCase.id;
  addText(card, 'h2', testCase.title);
  addText(card, 'p', `Kết quả mong đợi: ${testCase.expected.join(' hoặc ')}${testCase.quoteRequired ? ' · cần câu trích dẫn khớp nguyên văn' : ''}`, 'hint');
  const preview = document.createElement('details');
  const summary = addText(preview, 'summary', 'Xem chính xác payload sẽ gửi');
  summary.tabIndex = 0;
  addText(preview, 'pre', JSON.stringify({ phrase: testCase.phrase, sourceSentence: testCase.sourceSentence, prompt: testCase.prompt, answer: testCase.answer }));
  card.appendChild(preview);
  const consent = document.createElement('label');
  consent.className = 'eval-consent';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.dataset.consent = '1';
  consent.append(checkbox, document.createTextNode('Đồng ý gửi payload hiển thị ở trên tới provider đã cấu hình. Có thể phát sinh phí token.'));
  card.appendChild(consent);
  const controls = document.createElement('div');
  controls.className = 'eval-controls';
  const run = addText(controls, 'button', 'Gửi ca live', 'btn-primary');
  run.type = 'button';
  run.dataset.run = '1';
  const cancel = addText(controls, 'button', 'Hủy yêu cầu', 'btn-secondary');
  cancel.type = 'button';
  cancel.dataset.cancel = '1';
  cancel.disabled = true;
  card.appendChild(controls);
  const reviewFields = document.createElement('div');
  reviewFields.className = 'eval-fields';
  const relevance = document.createElement('label');
  relevance.append(document.createTextNode('Độ liên quan do người đánh giá chấm (1–5; để trống nếu chưa đánh giá)'));
  const score = document.createElement('select');
  score.dataset.relevance = '1';
  score.add(new Option('Chưa chấm', ''));
  for (let n = 1; n <= 5; n++) score.add(new Option(String(n), String(n)));
  relevance.appendChild(score);
  reviewFields.appendChild(relevance);
  const explanation = document.createElement('label');
  explanation.append(document.createTextNode('Chất lượng giải thích (1–5: 1 sai/không hữu ích · 3 một phần · 5 cụ thể, đúng và hữu ích)'));
  const explanationScore = document.createElement('select');
  explanationScore.dataset.explanationQuality = '1';
  explanationScore.add(new Option('Chưa chấm', ''));
  for (let n = 1; n <= 5; n++) explanationScore.add(new Option(String(n), String(n)));
  explanation.appendChild(explanationScore);
  reviewFields.appendChild(explanation);
  const note = document.createElement('label');
  note.append(document.createTextNode('Ghi chú đánh giá'));
  const noteArea = document.createElement('textarea');
  noteArea.rows = 2;
  noteArea.dataset.reviewerNote = '1';
  note.appendChild(noteArea);
  reviewFields.appendChild(note);
  card.appendChild(reviewFields);
  const resultBox = document.createElement('div');
  resultBox.className = 'eval-result hint';
  resultBox.setAttribute('aria-live', 'polite');
  resultBox.textContent = 'Chưa chạy.';
  card.appendChild(resultBox);
  return card;
}

function renderSummary() {
  const done = [...results.values()];
  const counts = summarizeLiveEvalResults(results);
  $('#eval-summary').textContent = done.length
    ? `${done.length}/${cases.length} ca đã thử (mẫu số provider calls/questions: ${counts.providerCalls}) · ${counts.successfulResponses} phản hồi hợp lệ · ${counts.verdictMatched}/${counts.verdictScored} verdict khớp · ${counts.quoteValid}/${counts.quoteScored} quote hợp lệ · ${counts.errors} lỗi provider. Đây chỉ là kết quả của các ca đã chạy, không phải kết luận chất lượng tổng quát.`
    : 'Chưa gửi ca kiểm tra nào. Đây là công cụ đánh giá thủ công, không phải điểm chuẩn hóa.';
  exportButton.disabled = done.length === 0;
}

function errorCategory(message) {
  const text = String(message || '').toLowerCase();
  if (/quote did not match/.test(text)) return 'invalid-quote';
  if (/invalid feedback|unexpected response|valid json/.test(text)) return 'invalid-format';
  if (/key|model access|401|403/.test(text)) return 'key-or-access';
  if (/quota|billing|402|429|rate limit/.test(text)) return 'quota-or-rate-limit';
  if (/json|format/.test(text)) return 'invalid-format';
  if (/cancel/.test(text)) return 'cancelled';
  if (/timed out|timeout/.test(text)) return 'timeout';
  if (/cors|reach|network|connection/.test(text)) return 'network-or-cors';
  return 'provider-error';
}

async function runCase(testCase, card) {
  const checkbox = $('[data-consent]', card);
  const box = $('.eval-result', card);
  const run = $('[data-run]', card);
  const cancel = $('[data-cancel]', card);
  const settings = getAiSettings();
  if (!settings.apiKey) { box.textContent = 'Chưa có API key. Chưa gửi yêu cầu.'; return; }
  if (!checkbox.checked) { box.textContent = 'Chưa gửi: hãy đồng ý sau khi xem payload.'; return; }
  const payload = { phrase: testCase.phrase, sourceSentence: testCase.sourceSentence, prompt: testCase.prompt, answer: testCase.answer };
  const generation = runGeneration;
  const controller = new AbortController();
  controllers.set(testCase.id, controller);
  run.disabled = true;
  cancel.disabled = false;
  box.textContent = 'Đang gọi provider…';
  const startedAt = performance.now();
  let record;
  try {
    const raw = await askTutor({
      signal: controller.signal,
      instructions: TUTOR_FEEDBACK_INSTRUCTIONS,
      input: JSON.stringify(payload),
    });
    const elapsedMs = Math.round(performance.now() - startedAt);
    const validated = validateTutorFeedback(raw, testCase.answer);
    const quoteExact = !raw.quote || testCase.answer.includes(String(raw.quote).trim());
    const quoteValid = quoteExact && (!testCase.quoteRequired || !!validated.quote);
    const expectedVerdictPass = testCase.expected.includes(validated.verdict);
    record = {
      caseId: testCase.id, title: testCase.title, provider: settings.provider, model: settings.model,
      timestamp: new Date().toISOString(), elapsedMs, status: 'success',
      payload, expectedVerdicts: testCase.expected, verdict: validated.verdict,
      expectedVerdictPass, rawVerdict: raw.verdict, evidenceStatus: validated.evidenceStatus, quote: validated.quote, quoteExact, quoteValid,
      feedback: validated, reviewerRelevance: $('[data-relevance]', card).value || null,
      explanationQuality: $('[data-explanation-quality]', card).value || null,
      reviewerNote: $('[data-reviewer-note]', card).value || '',
    };
    box.replaceChildren();
    addText(box, 'strong', `Live · ${settings.model} · ${elapsedMs} ms · ${expectedVerdictPass ? 'verdict khớp' : 'verdict chưa khớp'}`);
    addText(box, 'p', `Verdict: ${validated.verdict} · Quote: ${validated.quote ? `“${validated.quote}”` : '(trống)'} · khớp nguyên văn: ${quoteValid ? 'có' : 'không'}`);
    addText(box, 'p', validated.suggestion || validated.explanation_vi || 'Model không trả về góp ý cụ thể.');
    if (validated.explanation_vi) addText(box, 'p', validated.explanation_vi);
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startedAt);
    record = {
      caseId: testCase.id, title: testCase.title, provider: settings.provider, model: settings.model,
      timestamp: new Date().toISOString(), elapsedMs, status: 'error',
      errorCategory: errorCategory(error.message), error: error.message,
      payload, expectedVerdicts: testCase.expected, reviewerRelevance: $('[data-relevance]', card).value || null,
      explanationQuality: $('[data-explanation-quality]', card).value || null,
      reviewerNote: $('[data-reviewer-note]', card).value || '',
    };
    box.textContent = `Lỗi live · ${elapsedMs} ms · ${record.errorCategory}: ${error.message}`;
  } finally {
    controllers.delete(testCase.id);
    run.disabled = false;
    cancel.disabled = true;
    checkbox.checked = false;
  }
  // Clearing the report aborts any active requests. Their eventual rejection
  // must not repopulate the report after the user explicitly cleared it.
  if (generation === runGeneration) {
    results.set(testCase.id, record);
    renderSummary();
  }
}

caseRoot.addEventListener('click', (event) => {
  const card = event.target.closest('[data-case-id]');
  if (!card) return;
  const testCase = cases.find((item) => item.id === card.dataset.caseId);
  if (event.target.closest('[data-run]')) runCase(testCase, card);
  if (event.target.closest('[data-cancel]')) controllers.get(testCase.id)?.abort();
});

caseRoot.addEventListener('change', (event) => {
  if (!event.target.matches('[data-relevance],[data-explanation-quality],[data-reviewer-note]')) return;
  const card = event.target.closest('[data-case-id]');
  const record = results.get(card?.dataset.caseId);
  if (!record) return;
  record.reviewerRelevance = $('[data-relevance]', card).value || null;
  record.explanationQuality = $('[data-explanation-quality]', card).value || null;
  record.reviewerNote = $('[data-reviewer-note]', card).value || '';
});

for (const testCase of cases) caseRoot.appendChild(makeCaseCard(testCase));
statusEl.textContent = settingsLabel();
$('#eval-export').addEventListener('click', () => {
  const settings = getAiSettings();
  const report = {
    app: 'Dual Dictionary AI Tutor evaluation', version: 1, exportedAt: new Date().toISOString(),
    provider: settings.provider, model: settings.model,
    denominators: summarizeLiveEvalResults(results),
    note: 'No API key is included. Relevance and explanation-quality scores are AI-assisted reviewer judgments; this small authored set is not a general model quality or learning-outcome claim.',
    cases: [...results.values()],
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `dual-dictionary-ai-eval-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('#eval-clear').addEventListener('click', () => {
  runGeneration++;
  for (const controller of controllers.values()) controller.abort();
  controllers.clear();
  results.clear();
  caseRoot.replaceChildren(...cases.map(makeCaseCard));
  renderSummary();
});
