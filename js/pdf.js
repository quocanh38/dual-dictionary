/* pdf.js — thin, lazy wrapper around a vendored pdf.js build.
 * The heavy library (js/vendor/pdf.*.mjs) is imported ONLY when a PDF is opened,
 * so it never adds to the initial page weight. Extracts the text layer so the
 * Reader can show it with tap-to-lookup. */
let pdfjsPromise = null;
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('./vendor/pdf.min.mjs').then((mod) => {
      const lib = mod.default || mod;
      lib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
      return lib;
    });
  }
  return pdfjsPromise;
}

export async function parsePdf(buf) {
  const lib = await loadPdfjs();
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const doc = await lib.getDocument({ data: u8, isEvalSupported: false }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items.map((it) => (it.str || '')).join(' ').replace(/\s+/g, ' ').trim();
    if (line) text += (text ? '\n\n' : '') + line;
  }
  try { doc.destroy(); } catch (e) { /* ignore */ }
  return text;
}
