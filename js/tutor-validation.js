/** Strict checks for AI-generated tutor data. Article and learner text remain data, never instructions. */
function normalizedText(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
}
function containsText(haystack, needle) {
  const h = normalizedText(haystack), n = normalizedText(needle);
  return !!n && h.includes(n);
}
export function validateTutorPhrases(raw, article) {
  if (!Array.isArray(raw)) throw new Error('The provider returned an invalid phrase list. Please retry.');
  const valid = [], seen = new Set();
  for (const candidate of raw.slice(0, 12)) {
    if (!candidate || typeof candidate !== 'object') continue;
    const phrase = String(candidate.phrase || '').trim().slice(0, 120);
    const sourceSentence = String(candidate.sourceSentence || '').trim().slice(0, 700);
    const meaningVi = typeof candidate.meaningVi === 'string' ? candidate.meaningVi.trim().slice(0, 260) : '';
    const selectionReason = String(candidate.selectionReason || candidate.reason || '').trim().slice(0, 260);
    const key = normalizedText(phrase);
    if (!phrase || !meaningVi || !sourceSentence || !containsText(article, sourceSentence) || !containsText(sourceSentence, phrase) || seen.has(key)) continue;
    seen.add(key);
    valid.push({ phrase, sourceSentence, meaningVi, selectionReason });
  }
  return valid;
}
export function validateTutorFeedback(raw, answer) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('The provider returned invalid feedback. Please retry.');
  const quote = String(raw.quote || '').trim().slice(0, 500);
  if (quote && !String(answer).includes(quote)) throw new Error('Feedback quote did not match your answer; please retry.');
  const verdict = ['correct', 'incorrect', 'uncertain'].includes(raw.verdict)
    ? raw.verdict : raw.correct === true ? 'correct' : raw.correct === false ? 'incorrect' : 'uncertain';
  if ((verdict === 'incorrect' && !quote) || raw.evidenceStatus === 'missing-quote') {
    return { verdict: 'uncertain', correct: false, quote: '', evidenceStatus: 'missing-quote',
      issue: '', suggestion: '', retry_prompt: '',
      explanation_vi: 'AI chưa trích dẫn được đoạn trong câu trả lời để chứng minh nhận xét. Chưa xác nhận lỗi; bạn có thể viết rõ hơn hoặc yêu cầu đánh giá lại.' };
  }
  // Missing discourse context alone cannot substantiate a language error.
  // Keep this conservative: a concrete grammar/collocation diagnosis still
  // follows the ordinary quote checks instead of this clarification guard.
  const issue = String(raw.issue || '');
  const referenceOnly = /(?:pronoun|referent|antecedent|reference|identified object|đại từ|đối tượng|ngữ cảnh)/iu.test(issue)
    && /(?:unclear|unidentified|not (?:specified|identified)|no (?:clear |identified )?(?:referent|antecedent|object|context)|without|lack|chưa rõ|không rõ|chưa.*xác định|thiếu|không có)/iu.test(issue)
    && !/(?:verb form|tense|agreement|word order|particle|placement|collocation|preposition|chia động từ|thì động từ|trật tự|giới từ)/iu.test(issue);
  if(raw.evidenceStatus === 'context-ambiguity' || (verdict !== 'correct' && referenceOnly)) {
    return { verdict: 'uncertain', correct: false, quote, evidenceStatus: 'context-ambiguity',
      issue: '', suggestion: '', retry_prompt: 'If you want to clarify the meaning, what does the pronoun refer to?',
      explanation_vi: 'Thiếu ngữ cảnh chưa chứng minh câu sai ngữ pháp. Chưa xác nhận lỗi; nếu muốn, bạn có thể làm rõ đại từ đang chỉ điều gì.' };
  }
  return {
    evidenceStatus: quote ? 'quoted' : 'not-required',
    verdict, correct: verdict === 'correct', quote,
    issue: String(raw.issue || '').trim().slice(0, 500),
    suggestion: String(raw.suggestion || '').trim().slice(0, 700),
    explanation_vi: String(raw.explanation_vi || '').trim().slice(0, 700),
    retry_prompt: String(raw.retry_prompt || '').trim().slice(0, 500),
  };
}

export function validateTutorSituation(raw, payload) {
  const prompt = typeof raw?.prompt === 'string' ? raw.prompt.trim() : '';
  if (!prompt || prompt.length > 700) throw new Error('No valid practice prompt returned. Please retry.');
  if (raw.contextId !== payload.contextId) throw new Error('The provider did not use the requested new context. Please retry.');
  if (payload.previousPrompts.some(previous => normalizedText(previous) === normalizedText(prompt)) || /\b(rewrite|revise|correct your (answer|sentence))\b|viết lại|sửa lại/iu.test(prompt)) {
    throw new Error('The provider repeated a revision task instead of a new situation. Please retry.');
  }
  return { prompt, contextId: payload.contextId };
}
