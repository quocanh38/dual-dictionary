// Contract checks for the experimental photo-to-reading author path.
// No provider calls, no network, no DOM. Fails closed on any violation.
import assert from 'node:assert/strict';
import {
  PHOTO_PURPOSE, PHOTO_PROVIDER_ID, PHOTO_ACCEPTED_MIME,
  PHOTO_MAX_INPUT_BYTES, PHOTO_MAX_SEND_BYTES,
  validatePhotoInput, validatePhotoDataUrl,
  buildVisionRequest, previewVisionRequest, parseVisionResult,
} from '../../lessons/photo-request.js';

const results = [];
async function test(name, fn) { await fn(); results.push({ name, status: 'PASS' }); console.log('PASS ' + name); }

await test('photo input accepts JPEG/PNG/WebP under 8 MB', async () => {
  for (const type of PHOTO_ACCEPTED_MIME) assert.deepEqual(validatePhotoInput({ type, size: 1024 }), []);
  assert.ok(validatePhotoInput({ type: 'image/gif', size: 1024 }).length);
  assert.ok(validatePhotoInput({ type: 'image/jpeg', size: PHOTO_MAX_INPUT_BYTES + 1 }).length);
  assert.ok(validatePhotoInput(null).length);
});

await test('photo data URL must be valid and within send budget', async () => {
  const good = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(validatePhotoDataUrl(good), 'image/png');
  assert.throws(() => validatePhotoDataUrl('data:image/gif;base64,AAAA'), /valid|format/i);
  assert.throws(() => validatePhotoDataUrl('not-a-url'), /valid/i);
  assert.throws(() => validatePhotoDataUrl('data:image/png;base64,' + 'A'.repeat(PHOTO_MAX_SEND_BYTES)), /1\.5 MB/i);
});

await test('vision request exposes purpose, instructions and model before consent', async () => {
  const req = buildVisionRequest({ dataUrl: 'data:image/jpeg;base64,/9j/4AAQ', model: 'muse-spark-1.3' });
  assert.equal(req.purpose, PHOTO_PURPOSE);
  assert.equal(PHOTO_PROVIDER_ID, 'meta-model-api');
  assert.ok(req.instructions.includes('untrusted lesson data'));
  assert.ok(req.instructions.includes('JSON only'));
  assert.equal(req.model, 'muse-spark-1.3');
  assert.throws(() => buildVisionRequest({ dataUrl: 'data:image/jpeg;base64,/9j/4AAQ', model: ' ' }), /model ID/i);
  const preview = previewVisionRequest(req, 16);
  assert.ok(preview.input.imageDataUrl.includes('chars, sent in full'));
});

await test('vision result needs 100+ legible characters, never invented text', async () => {
  const ok = parseVisionResult({ reading_text: 'Notice: shift handover at 18:00. ' + 'x'.repeat(100) });
  assert.ok(ok.readingText.length >= 100);
  for (const bad of [null, [], {}, { reading_text: '' }, { reading_text: 'too short' }]) {
    assert.throws(() => parseVisionResult(bad), /legible|JSON|100/i);
  }
});

console.log(`${results.length} photo-request contract groups PASS`);
