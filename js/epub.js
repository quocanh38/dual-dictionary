/* epub.js — minimal, dependency-free EPUB reader.
 * EPUB is a ZIP of XHTML. We parse the ZIP central directory and inflate entries
 * with the browser's DecompressionStream('deflate-raw') (no external library, so
 * nothing is added to the initial page weight). Returns { title, text } so the
 * existing Reader (tap-to-lookup) can render it. */
function findEOCD(dv, len) {
  const min = Math.max(0, len - 22 - 65536);
  for (let i = len - 22; i >= min; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) return i;
  }
  return -1;
}
async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function parseEpub(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const eocd = findEOCD(dv, u8.length);
  if (eocd < 0) throw new Error('not a ZIP/EPUB file');
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const entries = {};
  for (let n = 0; n < count; n++) {
    if (off + 46 > u8.length || dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const localOff = dv.getUint32(off + 42, true);
    const name = new TextDecoder('utf-8').decode(u8.subarray(off + 46, off + 46 + nameLen));
    entries[name] = { method, compSize, localOff };
    off += 46 + nameLen + extraLen + commentLen;
  }
  async function read(name) {
    const e = entries[name];
    if (!e) return null;
    const lnl = dv.getUint16(e.localOff + 26, true);
    const lel = dv.getUint16(e.localOff + 28, true);
    const start = e.localOff + 30 + lnl + lel;
    const comp = u8.subarray(start, start + e.compSize);
    if (e.method === 0) return comp;
    if (e.method !== 8) throw new Error('unsupported zip compression: ' + e.method);
    return inflateRaw(comp);
  }

  const container = await read('META-INF/container.xml');
  if (!container) throw new Error('not an EPUB (missing META-INF/container.xml)');
  const cx = new DOMParser().parseFromString(new TextDecoder().decode(container), 'application/xml');
  const rootfile = cx.getElementsByTagName('rootfile')[0];
  const opfPath = rootfile ? rootfile.getAttribute('full-path') : '';
  if (!opfPath) throw new Error('EPUB is missing the OPF package');
  const opfBytes = await read(opfPath);
  if (!opfBytes) throw new Error('EPUB OPF not found: ' + opfPath);
  const opf = new DOMParser().parseFromString(new TextDecoder().decode(opfBytes), 'application/xml');
  const base = opfPath.indexOf('/') !== -1 ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const tEl = opf.getElementsByTagName('dc:title')[0] || opf.getElementsByTagName('title')[0];
  const title = tEl ? tEl.textContent.trim() : '';

  const items = {};
  for (const it of opf.getElementsByTagName('item')) items[it.getAttribute('id')] = it.getAttribute('href');
  const hrefs = [];
  for (const ir of opf.getElementsByTagName('itemref')) {
    const h = items[ir.getAttribute('idref')];
    if (h) hrefs.push(base + h);
  }

  let text = '';
  for (const h of hrefs) {
    const b = await read(h);
    if (!b) continue;
    const doc = new DOMParser().parseFromString(new TextDecoder().decode(b), 'text/html');
    for (const bad of doc.querySelectorAll('script,style,head')) bad.remove();
    const paras = [...doc.querySelectorAll('p,h1,h2,h3,h4,h5,li,blockquote,dd,figcaption,div')]
      .map((el) => el.textContent.replace(/\s+/g, ' ').trim())
      .filter((s) => s.length > 1);
    const body = paras.length ? paras.join('\n') : (doc.body ? doc.body.textContent.replace(/\s+/g, ' ').trim() : '');
    text += (text ? '\n\n' : '') + body;
  }
  return { title, text: text.trim() };
}
