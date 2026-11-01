#!/usr/bin/env node
/* P1 exam tags (owner-approved 01/11/2026): derive IELTS/TOEIC/CEFR-estimate
 * tags from data ALREADY in the repo (NGSL rank, AWL, freq band, OVDP entry
 * domain). No external CEFR list is bundled — CEFR is labeled an estimate
 * (tooltip says so on-page). Output: data/exam-tags.json {words:{w:{...}},
 * phrases:{slug:{...}}}. Deterministic; rerun any time. */
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..');

const freq = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'freq-en.json'), 'utf8'));
const ngsl = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'ngsl.json'), 'utf8'));
const awl = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'awl.json'), 'utf8'));
const awlSet = new Set(Object.keys(awl.words || {}));
const wm = JSON.parse(fs.readFileSync(path.join(REPO, 'docs', 'wordpages-manifest.json'), 'utf8'));
const pm = JSON.parse(fs.readFileSync(path.join(REPO, 'docs', 'phrasepages-manifest.json'), 'utf8'));

const bandNum = (b) => ({ '1k': 1, '2k': 2, '5k': 5, '10k': 10 }[b] || 99);

/* TOEIC business seed tokens: intentionally narrow (precision > recall).
 * A phrase is TOEIC-business when ANY token matches OR its hand-written
 * corpus entry carries an Econ-flavored pos/domain. */
const BIZ = new Set(['account', 'accounts', 'bank', 'balance', 'invoice', 'payment', 'payments', 'budget', 'finance', 'financial', 'marketing', 'sales', 'contract', 'contracts', 'meeting', 'meetings', 'office', 'shipment', 'shipping', 'delivery', 'order', 'orders', 'customer', 'customers', 'client', 'clients', 'employee', 'employees', 'manager', 'payroll', 'revenue', 'profit', 'loss', 'audit', 'tax', 'loan', 'credit', 'debit', 'stock', 'share', 'shares', 'board', 'quarter', 'fiscal', 'expense', 'expenses', 'claim', 'warranty', 'supplier', 'vendor', 'retail', 'wholesale', 'import', 'export', 'customs', 'freight', 'cargo', 'warehouse', 'inventory', 'deadline', 'overtime', 'recruit', 'hire', 'resign', 'promotion', 'salary', 'wage', 'conference', 'seminar', 'proposal', 'contractor', 'subsidiary', 'merger', 'acquisition', 'dividend', 'interest', 'mortgage', 'insurance', 'premium', 'itinerary', 'boarding', 'reservation', 'booking', 'commute', 'reimbursement', 'timesheet', 'paycheck', 'layoff', 'turnover', 'ceo', 'cfo', 'memo', 'agenda', 'minutes', 'genda']);

function wordTags(w) {
  const rank = ngsl.core[w] || null;
  const isAwl = awlSet.has(w);
  const band = freq[w] || '';
  const tags = [];
  if (isAwl || (rank && rank <= 2000)) tags.push('ielts');
  if (rank && rank <= 1000 && bandNum(band) <= 2 && !isAwl) tags.push('giao-tiep');
  // CEFR estimate (tooltip on-page says estimate, never asserted as official)
  let cefr = '';
  if (rank && rank <= 1000) cefr = 'A2';
  else if (rank && rank <= 2000) cefr = 'B1';
  else if (rank || isAwl) cefr = 'B2';
  else if (band === '5k' || band === '10k') cefr = 'C1';
  return { tags, cefr, rank, awl: isAwl, band };
}

function phraseTags(slug, phrase) {
  const toks = String(phrase).toLowerCase().split(/[\s-]+/).map((t) => t.replace(/[^a-z']/g, ''));
  const tags = [];
  if (toks.some((t) => BIZ.has(t))) tags.push('toeic');
  // IELTS: academic-flavored phrases (AWL token inside)
  if (toks.some((t) => awlSet.has(t))) tags.push('ielts');
  return { tags };
}

const words = {};
for (const w of wm.slugs || []) words[w] = wordTags(w);
const phrases = {};
for (const e of pm.entries || []) phrases[e.slug] = phraseTags(e.slug, e.phrase);

const ieltsW = Object.values(words).filter((t) => t.tags.includes('ielts')).length;
const gtW = Object.values(words).filter((t) => t.tags.includes('giao-tiep')).length;
const toeicP = Object.values(phrases).filter((t) => t.tags.includes('toeic')).length;
const ieltsP = Object.values(phrases).filter((t) => t.tags.includes('ielts')).length;
console.log(`words: ${Object.keys(words).length} (ielts ${ieltsW}, giao-tiep ${gtW}) · phrases: ${Object.keys(phrases).length} (toeic ${toeicP}, ielts ${ieltsP})`);
fs.writeFileSync(path.join(REPO, 'data', 'exam-tags.json'),
  JSON.stringify({ v: 1, source: 'tools/exam-tags.cjs', words, phrases }));
console.log('wrote data/exam-tags.json');
