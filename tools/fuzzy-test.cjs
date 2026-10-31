/* fuzzy-test.cjs — unit test cho js/fuzzy.js (v111). Chạy: node tools/fuzzy-test.cjs
 * Assert-first theo style project: mọi lệch là FAIL rõ tên case. */
const assert = require('assert');
const DSFuzzy = require('../js/fuzzy.js');
const built = require('../data/built-words.json').words;

const { levBounded, suggestFor } = DSFuzzy;

// --- levBounded ---
assert.strictEqual(levBounded('apple', 'apple', 2), 0, 'lev identical');
assert.strictEqual(levBounded('aple', 'apple', 2), 1, 'lev aple→apple = 1');
assert.strictEqual(levBounded('calld', 'called', 2), 1, 'lev calld→called = 1');
assert.strictEqual(levBounded('recieve', 'receive', 2), 2, 'lev transposition = 2 (không có Damerau — đúng spec)');
assert.strictEqual(levBounded('abc', 'xyz', 2), 3, 'lev hoàn toàn khác > max → max+1');
assert.strictEqual(levBounded('a', 'abcdefgh', 2), 3, 'chênh dài > max → max+1 prune');
assert.strictEqual(levBounded('', 'abc', 2), 3, 'empty query');
console.log('levBounded OK');

// --- suggestFor: chất lượng ranking trên built-words thật ---
const t = (q) => suggestFor(q, built, null, { limit: 3 });
// dist-1 luôn trước dist-2; cùng dist thì band nhỏ (phổ biến hơn) trước
const five = suggestFor('aplee', built, null, { limit: 5 });
assert.strictEqual(five.length, 5, 'aplee: đủ 5 ứng viên dist ≤ 2');
assert.ok(five.indexOf('apple') !== -1, 'aplee: apple có mặt trong dist-2 (band 5k)');
assert.ok(t('aple').includes('apple'), 'aple gợi ý apple (cùng hàng able/ale — dist 1 hết)');
assert.ok(t('aple').length >= 1 && t('aple').length <= 3, 'aple: 1–3 chip');
assert.ok(t('calld').includes('call'), 'calld gợi ý call');
assert.ok(t('calld').includes('called'), 'calld gợi ý called');
// query ngắn: 2 ký tự → không gợi ý
assert.deepStrictEqual(t('ap'), [], 'query <3 ký tự → rỗng');
// cụm từ: không fuzzy
assert.deepStrictEqual(t('look forward'), [], 'có khoảng trắng → rỗng (chỉ single-token)');
// exclude được tôn trọng (từ đã hiển thị trong banner fallback không lặp chip)
const ex = suggestFor('aple', built, null, { exclude: ['apple'] });
assert.ok(!ex.includes('apple'), 'exclude apple → chip không lặp lại');
assert.ok(ex.length >= 1, 'exclude vẫn còn ứng viên khác');
// thứ tự band: 2 ứng viên cùng dist — band nhỏ trước
const two = suggestFor('abandn', built, null, { limit: 5 });
assert.strictEqual(two[0], 'abandon', 'abandn → abandon (band 5k) đầu');
console.log('suggestFor OK');

// --- hiệu năng: built (6.839) + mô phỏng 386k key OVDP ---
const fakeKeys = [];
for (let i = 0; i < 386000; i++) fakeKeys.push('k' + i.toString(36).padStart(4, '0') + 'x');
const t0 = Date.now();
const out = suggestFor('aple', built, [fakeKeys], { limit: 3 });
const ms = Date.now() - t0;
assert.ok(out.includes('apple'), 'perf-run vẫn đúng kết quả');
assert.ok(ms < 250, `perf: ${ms}ms phải < 250ms`);
console.log(`perf OK: ${ms}ms với built 6.839 + 386k keys`);
console.log('ALL PASS');
