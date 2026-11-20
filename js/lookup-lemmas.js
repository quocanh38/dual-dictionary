export function lemmaCandidates(word) {
  const w = String(word || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const out = [];
  const push = (s) => { if (s && s.length >= 2 && out.indexOf(s) === -1) out.push(s); };
  push(w);
  const cut = (base, suffixes, restored) => {
    for (const suf of suffixes) {
      if (w.length > suf.length + 1 && w.endsWith(suf)) push(w.slice(0, -suf.length) + restored);
    }
  };
  // irregular forms worth naming (the ones a rule set cannot guess)
  const IRREGULAR = {
    ran: 'run', went: 'go', gone: 'go', did: 'do', done: 'do', was: 'be', were: 'be', been: 'be',
    had: 'have', has: 'have', said: 'say', made: 'make', took: 'take', taken: 'take', gave: 'give',
    given: 'give', got: 'get', gotten: 'get', came: 'come', saw: 'see', seen: 'see', knew: 'know',
    known: 'know', thought: 'think', found: 'find', told: 'tell', felt: 'feel', left: 'leave',
    men: 'man', women: 'woman', children: 'child', feet: 'foot', teeth: 'tooth', mice: 'mouse',
    better: 'good', best: 'good', worse: 'bad', worst: 'bad', those: 'that', these: 'this',
  };
  if (IRREGULAR[w]) push(IRREGULAR[w]);
  // ...-ies → ...-y
  cut('', ['ies'], 'y');
  // ...-ed → base / base+e / de-doubled consonant
  if (w.length > 3 && w.endsWith('ied')) push(w.slice(0, -3) + 'y');
  if (w.length > 3 && w.endsWith('ed')) {
    const stem = w.slice(0, -2);
    push(stem);
    push(stem + 'e');
    if (/([bdfglmnprt])\1$/.test(stem)) push(stem.slice(0, -1));
    push(w.slice(0, -1)); // "moved" → "move", already covered by stem+'e'; keeps "liked"→"like"
  }
  // ...-ing → base / base+e / de-doubled consonant
  if (w.length > 4 && w.endsWith('ing')) {
    const stem = w.slice(0, -3);
    push(stem);
    push(stem + 'e');
    if (/([bdfglmnprt])\1$/.test(stem)) push(stem.slice(0, -1));
  }
  // ...-es / ...-s (plural + 3rd person)
  if (w.length > 3 && w.endsWith('es')) push(w.slice(0, -2));
  if (w.length > 2 && w.endsWith('s')) push(w.slice(0, -1));
  if (w.length > 4 && w.endsWith('ses')) push(w.slice(0, -2)); // "classes" → "class"
  return out.filter((c) => c.length >= 2);
}

