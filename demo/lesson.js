import { addItem, allItems } from '../js/store.js';
const KEY = 'dd-offline-lesson-v1';
const article = 'Our team will carry out research into how students learn new vocabulary. We will collect examples and compare the results next week.';
const phrases = [
  { phrase: 'carry out research', meaning: 'conduct a systematic investigation', vi: 'tiến hành nghiên cứu', source: 'Our team will carry out research into how students learn new vocabulary.', question: 'Your team wants to understand why learners forget new words. Which sentence uses the phrase correctly?', options: ['We will carry out research into why learners forget new words.', 'We will carries out research into why learners forget new words.', 'We will carry out a research into why learners forget new words.'], explanation: 'After “will”, use the base form “carry”. “Research” is normally uncountable in this use: carry out research into a topic.' },
  { phrase: 'compare the results', meaning: 'examine the findings to identify similarities and differences', vi: 'so sánh các kết quả', source: 'We will collect examples and compare the results next week.', question: 'Your team has findings from two classes. Which action matches “compare the results”?', options: ['Examine both classes’ findings to identify similarities and differences.', 'Delete one class’s findings without reading them.', 'Collect examples but never look at the findings together.'], explanation: 'To compare the results, examine two or more sets of findings for similarities and differences.' }
];
const fresh = () => ({ step: 0, selected: null, choice: null, checked: false, revealed: false, itemId: null });
let state = fresh();
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Number.isInteger(s.step) && s.step >= 0 && s.step <= 5 && (s.selected === 0 || s.selected === 1 || (s.step <= 1 && s.selected === null))) state = { ...fresh(), ...s }; } catch { /* start fresh if storage is unreadable */ }
const stage = document.querySelector('#stage'), status = document.querySelector('#status');
let saving = false;
function el(tag, text) { const e = document.createElement(tag); e.textContent = text; return e; }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { status.textContent = 'Lesson progress could not be stored. Keep this page open; Vault saving is checked separately.'; return false; } }
function button(label, action) { const b = el('button', label); b.type = 'button'; b.className = 'btn-secondary'; b.onclick = action; stage.append(b); return b; }
function link(label, url) { const a = el('a', label); a.href = url; stage.append(a, el('p', '')); }
function go(step) { state.step = step; persist(); render(true); }
function selected() { return phrases[state.selected]; }
async function savedCard() { return (await allItems()).find(i => i.id === state.itemId); }
function render(focus = false) {
  stage.replaceChildren(); status.textContent = '';
  stage.append(el('p', `Step ${state.step + 1} of 6`));
  const title = el('h2', ['Read a short passage', 'Choose a phrase', 'Try an authored exercise', 'Save your phrase', 'Recall your saved meaning', 'Lesson complete'][state.step]); title.tabIndex = -1; stage.append(title);
  const p = selected();
  if (state.step === 0) { stage.append(el('blockquote', article)); button('Choose a phrase', () => go(1)); }
  if (state.step === 1) {
    stage.append(el('p', 'Choose one phrase to practise and save. Both meanings below are authored, not generated.'));
    phrases.forEach((p, i) => { const section = el('section', ''); section.append(el('h3', p.phrase), el('p', `${p.meaning} · ${p.vi}`), el('blockquote', p.source)); const b = el('button', `Practise: ${p.phrase}`); b.type = 'button'; b.onclick = () => { state.selected = i; state.choice = null; state.checked = false; state.revealed = false; state.itemId = null; go(2); }; section.append(b); stage.append(section); });
  }
  if (state.step === 2 && p) {
    const f = el('fieldset', ''); f.append(el('legend', p.question));
    // Put the authored correct answer in a different position for each phrase.
    const order = state.selected === 0 ? [1, 0, 2] : [2, 1, 0];
    order.forEach(i => { const l = el('label', ''); const input = document.createElement('input'); input.type = 'radio'; input.name = 'answer'; input.value = String(i); input.checked = state.choice === i; input.onchange = () => { state.choice = i; state.checked = false; persist(); render(); stage.querySelector(`input[value="${i}"]`).focus(); }; l.append(input, document.createTextNode(' ' + p.options[i])); f.append(l); }); stage.append(f);
    button('Check answer', () => { if (state.choice === null) { status.textContent = 'Choose an answer first.'; f.querySelector('input').focus(); return; } state.checked = true; persist(); render(); status.textContent = state.choice === 0 ? 'Correct — authored answer key.' : 'Not yet. Read the explanation and try again.'; });
    if (state.checked) { stage.append(el('p', p.explanation)); if (state.choice === 0) button('Continue to save', () => go(3)); }
  }
  if (state.step === 3 && p) {
    stage.append(el('h3', p.phrase), el('p', `${p.meaning} · ${p.vi}`), el('blockquote', p.source), el('p', 'Save a real card with this meaning and source sentence. This does not grade an FSRS review.'));
    button('Save phrase to Vault', async event => {
      if (saving) return; saving = true; const b = event.currentTarget; b.disabled = true;
      try {
        const senseKey = `authored-lesson-v1:${state.selected}`;
        const { item } = await addItem({ id: `dd-authored-lesson-v1-${state.selected}`, type: 'phrase', text: p.phrase, dictionary: { source: 'Authored offline lesson · not AI', entryKey: p.phrase, senseKey, definition: `${p.meaning} · ${p.vi}` }, context: { sentence: p.source, headword: p.phrase, sourceTitle: 'Your first offline phrase lesson' }, tags: ['authored-lesson'], sourceTag: 'authored-offline-lesson-v1' });
        state.itemId = item.id; state.revealed = false; go(4);
      } catch { status.textContent = 'Could not save to Vault. Check browser storage and try again. Your lesson is not marked saved.'; b.disabled = false; }
      finally { saving = false; }
    });
  }
  if (state.step === 4 && p) {
    stage.append(el('h3', p.phrase), el('p', 'Recall the meaning before revealing your saved card. This is an ungraded recall exercise; your FSRS schedule stays unchanged.'));
    const reveal = button('Reveal saved meaning', async () => {
      reveal.disabled = true;
      try { const item = await savedCard(); if (!item) { status.textContent = 'This card is no longer in Vault. Save it again to continue.'; button('Return to save', () => go(3)); return; } state.revealed = true; persist(); const box = el('section', ''); box.append(el('p', item.dictionary.definition), el('blockquote', item.context.sentence)); stage.append(box); button('Finish recall', () => go(5)); }
      catch { status.textContent = 'Could not read Vault. Please retry.'; reveal.disabled = false; }
    });
  }
  if (state.step === 5 && p) {
    stage.append(el('p', 'You read, chose a phrase, completed an authored exercise, saved a real card, and recalled its meaning. No AI request was made.'));
    link('Open Vault', '../index.html#/vault'); link('Open Review for spaced repetition', '../index.html#/review');
    stage.append(el('p', 'Review grades are recorded only when you explicitly grade a card in Review.'));
    stage.append(el('h3', 'Create your own situation with Meta Tutor'), el('p', 'Optional live AI: requires internet, your own provider key, and consent for each request. Provider charges may apply. Start from this passage in Reader, choose AI practice, then select your phrase if offered.'));
    button('Open Reader for optional Meta Tutor', () => { try { sessionStorage.setItem('dd-tutorial-article', article); location.href = '../index.html#/reader'; } catch { status.textContent = 'Could not open the passage automatically. Copy the reading from step 1 into Reader.'; } });
  }
  if (focus) title.focus();
}
document.querySelector('#reset').onclick = () => { state = fresh(); persist(); render(true); };
render();
// Caching the lesson must work even when this is the first page opened.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js').catch(() => { status.textContent = 'Offline caching is unavailable. The lesson still works while this page is open.'; });
