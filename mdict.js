/**
 * mdict.js — Pure-JS MDX/MDD parser (no dependencies).
 *
 * Works in browsers and Node >= 18 (needs Blob + DecompressionStream).
 * Based on the MDX 2.0 file format as implemented by mdict-analysis,
 * mdict-utils and js-mdict.
 *
 * Layout (version >= 2.0, numbers big-endian unless noted):
 *   [header]  4B LE length, UTF-16LE XML text, 4B adler32
 *   [key header]   5 x 8B: numKeyBlocks, numEntries, keyInfoUnpackSize,
 *                          keyInfoPackedSize, keyBlocksPackedSize (+ 4B adler32)
 *   [key info]     (v2: "02 00 00 00" + 4B adler32, rest zlib) per block:
 *                  wordCount(8B) firstWordSize(2B) firstWord lastWordSize(2B)
 *                  lastWord packSize(8B) unpackSize(8B)
 *   [key blocks]   each: 4B compType + 4B adler32 + zlib data; entries:
 *                  offset(numWidth B) + key text + NUL(s)
 *   [record header] 4 x 8B: numRecordBlocks, numEntries, infoSize, blockSize
 *   [record info]   pairs of (packSize, unpackSize), 8B each
 *   [record blocks] each: 4B compType + 4B adler32 + zlib data
 * Record offsets stored in key blocks are absolute offsets into the
 * concatenated DECOMPRESSED record stream.
 */

const ENC_LABEL = {
  'utf-8': 'utf-8', utf8: 'utf-8',
  'utf-16le': 'utf-16le', utf16le: 'utf-16le', utf16: 'utf-16le', 'utf-16': 'utf-16le',
  gbk: 'gb18030', gb2312: 'gb18030', gb18030: 'gb18030',
  big5: 'big5', bigfive: 'big5', cp950: 'big5',
};

function makeDecoder(label) {
  try { return new TextDecoder(label); } catch (e) { return new TextDecoder('utf-8'); }
}

async function inflateZlib(bytes) {
  const ds = new DecompressionStream('deflate');
  const resp = new Response(new Blob([bytes]).stream().pipeThrough(ds));
  return new Uint8Array(await resp.arrayBuffer());
}

async function maybeInflate(bytes) {
  // Block starts with 4B compType (00=none, 02=zlib) + 4B adler32.
  const t = bytes[0];
  if (t === 0x00) return bytes.slice(8);
  if (t === 0x02) return inflateZlib(bytes.slice(8));
  if (t === 0x01) throw new Error('This dictionary uses LZO compression (rare) — not supported. Please use a zlib-compressed .mdx.');
  throw new Error('Unknown block compression type 0x' + t.toString(16) + ' — the file may be corrupted or in an unsupported format.');
}

/* ---- RIPEMD-128 (needed to unwrap MDict Encrypted=2 key-info blocks) ---- */
function ripemd128(bytes) {
  const ZL = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,
              3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,
              4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13];
  const ZR = [5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,
              15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,
              12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11];
  const SL = [11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,
              11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,
              9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6];
  const SR = [8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,
              9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,
              8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11];
  const K  = [0, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc];
  const K2 = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0];
  const rl = (x, n) => (((x << n) | (x >>> (32 - n))) >>> 0);
  const f = (j, x, y, z) =>
    j < 16 ? (x ^ y ^ z)
    : j < 32 ? ((x & y) | (~x & z))
    : j < 48 ? ((x | ~y) ^ z)
    : ((x & z) | (y & ~z));

  // pad: 0x80 + zeros to ≡56 mod 64 + 8-byte LE bit length
  const bitLen = bytes.length * 8;
  const paddedLen = (((bytes.length + 8) >> 6) + 1) << 6;
  const msg = new Uint8Array(paddedLen);
  msg.set(bytes);
  msg[bytes.length] = 0x80;
  const dvLen = new DataView(msg.buffer);
  dvLen.setUint32(paddedLen - 8, bitLen >>> 0, true);
  dvLen.setUint32(paddedLen - 4, Math.floor(bitLen / 0x100000000), true);

  const dv = new DataView(msg.buffer);
  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  for (let off = 0; off < paddedLen; off += 64) {
    const X = [];
    for (let i = 0; i < 16; i++) X.push(dv.getUint32(off + i * 4, true));
    let A = h[0], B = h[1], C = h[2], D = h[3];
    let A2 = h[0], B2 = h[1], C2 = h[2], D2 = h[3];
    for (let j = 0; j < 64; j++) {
      const T = rl((A + f(j, B, C, D) + X[ZL[j]] + K[j >> 4]) >>> 0, SL[j]) >>> 0;
      A = D; D = C; C = B; B = T;
      const T2 = rl((A2 + f(63 - j, B2, C2, D2) + X[ZR[j]] + K2[j >> 4]) >>> 0, SR[j]) >>> 0;
      A2 = D2; D2 = C2; C2 = B2; B2 = T2;
    }
    const T = (h[1] + C + D2) >>> 0;
    h[1] = (h[2] + D + A2) >>> 0;
    h[2] = (h[3] + A + B2) >>> 0;
    h[3] = (h[0] + B + C2) >>> 0;
    h[0] = T;
  }
  const out = new Uint8Array(16);
  const odv = new DataView(out.buffer);
  for (let i = 0; i < 4; i++) odv.setUint32(i * 4, h[i], true);
  return out;
}

/** Undo MDict's standard Encrypted=2 key-info obfuscation (fixed key, no passcode). */
function mdxDecryptKeyInfo(block) {
  const seed = new Uint8Array(8);
  seed.set(block.subarray(4, 8), 0);
  seed[4] = 0x95; seed[5] = 0x36; seed[6] = 0x00; seed[7] = 0x00; // LE 0x3695
  const key = ripemd128(seed);
  const data = block.subarray(8);
  const out = new Uint8Array(data.length);
  let previous = 0x36;
  for (let i = 0; i < data.length; i++) {
    const orig = data[i];
    const t = (((orig >> 4) | (orig << 4)) & 0xff) ^ previous ^ (i & 0xff) ^ key[i % key.length];
    out[i] = t;
    previous = orig;
  }
  const full = new Uint8Array(8 + data.length);
  full.set(block.subarray(0, 8), 0);
  full.set(out, 8);
  return full;
}

export class MDict {
  /**
   * @param {Blob} blob the .mdx or .mdd file
   * @param {string} name display name
   */
  constructor(blob, name = '') {
    this.blob = blob;
    this.name = name;
    this.ext = (name.toLowerCase().endsWith('.mdd')) ? 'mdd' : 'mdx';
    this.ready = false;
    // caches
    this._keyBlockCache = new Map();  // blockIdx -> array of {key, offset}
    this._recordBlockCache = new Map(); // blockIdx -> Uint8Array
    this._keyBlockCacheOrder = [];
    this._recordBlockCacheOrder = [];
    this.allKeys = null; // filled by loadAllKeys()
  }

  async init() {
    // ---- header ----
    const head = await this._read(0, 8);
    const dv = new DataView(head.buffer, head.byteOffset, head.byteLength);
    const headerLen = dv.getUint32(0, false); // big-endian, per MDX spec
    this._headerLen = headerLen;
    const headerBytes = await this._read(4, headerLen);
    const headerText = new TextDecoder('utf-16le').decode(headerBytes.slice(0, headerLen - 2));
    this.header = {};
    headerText.replace(/<\?xml[^>]*\?>/, '').replace(/\/>$/, '').trim()
      .replace(/^<Dictionary/, '').replace(/>$/, '')
      .replace(/\s([\w-]+)="((?:[^"]|\\")*)"/g, (m, k, v) => { this.header[k] = v; return ''; });
    this.title = this.header.Title || this.name;
    const ver = parseFloat(this.header.GeneratedByEngineVersion || '1.2');
    this.version = ver;
    this.numWidth = ver >= 2.0 ? 8 : 4;
    const enc = (this.header.Encoding || '').toLowerCase().replace('-', '');
    if (this.ext === 'mdd') this.encoding = 'utf-16le';
    else if (!enc) this.encoding = 'utf-8';
    else this.encoding = ENC_LABEL[enc] || 'utf-8';
    this.decoder = makeDecoder(this.encoding);
    const e = parseInt(this.header.Encrypted || '0', 10) || 0;
    // bit 1: record blocks encrypted with a per-file passcode — unsupported.
    // bit 2 (Encrypted=2): key info obfuscated with the standard fixed-key scheme
    // (ripemd128 + 0x3695) — decryptable without any passcode, handled below.
    if (e & 1) {
      throw new Error('File is passcode-encrypted (Encrypted=' + e + ') — not supported. Please use a non-encrypted .mdx.');
    }
    this.encrypt = e;
    this.stripKey = (this.header.StripKey || 'Yes').toLowerCase() !== 'no';
    this.keyCase = (this.header.KeyCaseSensitive || 'No').toLowerCase() === 'yes';

    // ---- key header ----
    const keyHeaderLen = ver >= 2.0 ? 5 * 8 : 4 * 4;
    const kh = await this._read(this._headerEnd(), keyHeaderLen);
    const khdv = new DataView(kh.buffer, kh.byteOffset, kh.byteLength);
    let o = 0;
    const num = () => { const v = ver >= 2.0 ? khdv.getBigUint64(o) : BigInt(khdv.getUint32(o)); o += this.numWidth; return Number(v); };
    this.numKeyBlocks = num();
    this.numEntries = num();
    if (ver >= 2.0) this.keyInfoUnpackSize = num();
    this.keyInfoPackedSize = num();
    this.keyBlocksPackedSize = num();

    // ---- key info ----
    let infoBytes = await this._read(this._headerEnd() + keyHeaderLen + (ver >= 2.0 ? 4 : 0), this.keyInfoPackedSize);
    if (ver >= 2.0) {
      if (this.encrypt & 2) infoBytes = mdxDecryptKeyInfo(infoBytes);
      if (infoBytes[0] === 0x02) infoBytes = await inflateZlib(infoBytes.slice(8));
      else if (infoBytes[0] === 0x00) infoBytes = infoBytes.slice(8);
      // else: some packers emit raw info — keep as-is
    }
    this.keyInfoList = [];
    let idx = 0;
    const width = this.encoding === 'utf-16le' ? 2 : 1;
    const iv = new DataView(infoBytes.buffer, infoBytes.byteOffset, infoBytes.byteLength);
    for (let b = 0; b < this.numKeyBlocks; b++) {
      const wordCount = this._readBE(iv, idx, this.numWidth); idx += this.numWidth;
      let fs = iv.getUint16(idx); idx += 2;
      fs = ver >= 2.0 ? (this.encoding === 'utf-16le' ? (fs + 1) * 2 : fs + 1)
                      : (this.encoding === 'utf-16le' ? fs * 2 : fs);
      idx += fs;
      let ls = iv.getUint16(idx); idx += 2;
      ls = ver >= 2.0 ? (this.encoding === 'utf-16le' ? (ls + 1) * 2 : ls + 1)
                      : (this.encoding === 'utf-16le' ? ls * 2 : ls);
      idx += ls;
      const packSize = this._readBE(iv, idx, this.numWidth); idx += this.numWidth;
      const unpackSize = this._readBE(iv, idx, this.numWidth); idx += this.numWidth;
      this.keyInfoList.push({ wordCount, packSize, unpackSize });
    }
    this._keyBlocksStart = this._headerEnd() + keyHeaderLen + (ver >= 2.0 ? 4 : 0) + this.keyInfoPackedSize;

    // ---- record header ----
    const rhStart = this._keyBlocksStart + this.keyBlocksPackedSize;
    const rhLen = ver >= 2.0 ? 4 * 8 : 4 * 4;
    const rh = await this._read(rhStart, rhLen);
    const rhdv = new DataView(rh.buffer, rh.byteOffset, rh.byteLength);
    o = 0;
    const rnum = () => { const v = ver >= 2.0 ? rhdv.getBigUint64(o) : BigInt(rhdv.getUint32(o)); o += this.numWidth; return Number(v); };
    this.numRecordBlocks = rnum();
    this.numRecordEntries = rnum();
    this.recordInfoSize = rnum();
    this.recordBlocksPackedSize = rnum();
    const ri = await this._read(rhStart + rhLen, this.recordInfoSize);
    const ridv = new DataView(ri.buffer, ri.byteOffset, ri.byteLength);
    this.recordInfoList = [];
    let packAcc = 0, unpackAcc = 0, ro = 0;
    for (let i = 0; i < this.numRecordBlocks; i++) {
      const p = this._readBE(ridv, ro, this.numWidth); ro += this.numWidth;
      const u = this._readBE(ridv, ro, this.numWidth); ro += this.numWidth;
      this.recordInfoList.push({ packSize: p, unpackSize: u, packAcc, unpackAcc });
      packAcc += p; unpackAcc += u;
    }
    this._recordBlocksStart = rhStart + rhLen + this.recordInfoSize;
    this.ready = true;
    return this;
  }

  _headerEnd() { return 4 + (this._headerLen ?? 0) + 4; }

  async _read(offset, size) {
    const buf = await this.blob.slice(offset, offset + size).arrayBuffer();
    return new Uint8Array(buf);
  }

  _readBE(dv, offset, width) {
    return width === 4 ? dv.getUint32(offset) : Number(dv.getBigUint64(offset));
  }

  // ---------- key normalization ----------
  normKey(s) {
    let k = s;
    if (!this.keyCase) k = k.toLowerCase();
    if (this.stripKey && this.ext === 'mdx') k = k.replace(/[\s\-.,:;!?'"()\[\]{}\/\\]/g, '');
    return k;
  }

  // ---------- key blocks ----------
  async _getKeyBlock(bi) {
    if (this._keyBlockCache.has(bi)) return this._keyBlockCache.get(bi);
    const info = this.keyInfoList[bi];
    const packed = await this._read(this._keyBlocksStart + this._keyPackAcc(bi), info.packSize);
    // Always go through maybeInflate() — even for compType 0x00 (uncompressed) it still
    // needs to strip the leading 8-byte compType+adler32 header. Special-casing that
    // check here previously skipped the strip for uncompressed blocks, shifting every
    // entry offset in the block by 8 bytes (see _getRecord() for the correct pattern).
    const data = await maybeInflate(packed);
    const entries = [];
    let i = 0;
    const width = this.encoding === 'utf-16le' ? 2 : 1;
    while (i < data.length) {
      const offset = this._readBytes(data, i, this.numWidth); i += this.numWidth;
      let j = i;
      while (j < data.length) {
        if (data[j] === 0 && (width === 1 || data[j + 1] === 0)) break;
        j += width;
      }
      const key = this.decoder.decode(data.subarray(i, j));
      entries.push({ key, offset });
      i = j + width;
    }
    if (this._keyBlockCacheOrder.length >= 12) {
      const old = this._keyBlockCacheOrder.shift();
      this._keyBlockCache.delete(old);
    }
    this._keyBlockCache.set(bi, entries);
    this._keyBlockCacheOrder.push(bi);
    return entries;
  }

  _readBytes(data, off, width) {
    let v = 0n;
    for (let i = 0; i < width; i++) v = (v << 8n) | BigInt(data[off + i]);
    return Number(v);
  }

  _keyPackAcc(bi) {
    let acc = 0;
    for (let i = 0; i < bi; i++) acc += this.keyInfoList[i].packSize;
    return acc; // small; keyInfoList is at most a few thousand entries
  }

  /**
   * Look up all entries matching `word` (after normalization).
   * MDX: returns [{keyText, text}] — text is the raw HTML of the entry.
   * MDD: pass exact resource key (with leading '\' or '/'); returns [{keyText, bytes}].
   */
  async lookup(word) {
    if (!this.ready) throw new Error('Dictionary not initialised');
    if (this.ext !== 'mdd') return this._lookupWord(word);
    // MDD resource keys normally use backslash separators and a leading '\'
    // (e.g. \hwd\bre\6\run_up0205.mp3). Try the given form, then normalised ones.
    const stripped = word.replace(/^[\\/]+/, '');
    const variants = [word, '\\' + stripped, '\\' + stripped.replace(/\//g, '\\')];
    for (const w of [...new Set(variants)]) {
      const out = await this._lookupWord(w);
      if (out.length) return out;
    }
    return [];
  }

  async _lookupWord(word) {
    const target = this.normKey(word);
    // binary search over key blocks by first/last normalized key
    const entries = await this._findEntries(word);
    const out = [];
    for (const e of entries) {
      if (this.normKey(e.key) !== target && !(this.ext === 'mdd' && (e.key === word || e.key === '/' + word || e.key === '\\' + word))) continue;
      const record = await this._getRecord(e.offset, e.end);
      if (this.ext === 'mdd') out.push({ keyText: e.key, bytes: record });
      else out.push({ keyText: e.key, text: this.decoder.decode(record) });
    }
    return out;
  }

  async _findEntries(word) {
    // binary search block whose normalized first/last key range contains target
    const target = this.normKey(word);
    let lo = 0, hi = this.keyInfoList.length - 1, hit = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const first = await this._blockFirstLast(mid);
      const nf = this.normKey(first.first), nl = this.normKey(first.last);
      if (target >= nf && target <= nl) { hit = mid; break; }
      else if (target < nf) hi = mid - 1;
      else lo = mid + 1;
    }
    if (hit === -1) return [];
    const entries = await this._getKeyBlock(hit);
    const res = [];
    for (let i = 0; i < entries.length; i++) {
      if (this.normKey(entries[i].key) === target) {
        entries[i].end = i + 1 < entries.length ? entries[i + 1].offset : undefined;
        res.push(entries[i]);
      }
    }
    return res;
  }

  async _blockFirstLast(bi) {
    const entries = await this._getKeyBlock(bi);
    return { first: entries[0]?.key ?? '', last: entries[entries.length - 1]?.key ?? '' };
  }

  // ---------- records ----------
  async _getRecord(start, end) {
    // find record block containing `start` (offset into decompressed stream)
    let lo = 0, hi = this.recordInfoList.length - 1, bi = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const r = this.recordInfoList[mid];
      if (r.unpackAcc > start) hi = mid - 1;
      else if (r.unpackAcc + r.unpackSize <= start) lo = mid + 1;
      else { bi = mid; break; }
    }
    if (bi === -1) throw new Error('Record offset not found: ' + start);
    const info = this.recordInfoList[bi];
    let block = this._recordBlockCache.get(bi);
    if (!block) {
      const packed = await this._read(this._recordBlocksStart + info.packAcc, info.packSize);
      block = await maybeInflate(packed);
      if (this._recordBlockCacheOrder.length >= 4) {
        const old = this._recordBlockCacheOrder.shift();
        this._recordBlockCache.delete(old);
      }
      this._recordBlockCache.set(bi, block);
      this._recordBlockCacheOrder.push(bi);
    }
    const from = start - info.unpackAcc;
    const to = end != null ? end - info.unpackAcc : block.length;
    return block.slice(from, Math.max(from, Math.min(to, block.length)));
  }

  /** Read every key text (for autocomplete). MDX only. Progress callback. */
  async loadAllKeys(onProgress) {
    if (this.allKeys) return this.allKeys;
    const keys = [];
    for (let bi = 0; bi < this.keyInfoList.length; bi++) {
      const entries = await this._getKeyBlock(bi);
      for (const e of entries) keys.push(e.key);
      if (onProgress && bi % 25 === 0) onProgress(bi + 1, this.keyInfoList.length);
      if (this._keyBlockCacheOrder.length > 2) { // don't keep many in cache here
        const old = this._keyBlockCacheOrder.shift();
        this._keyBlockCache.delete(old);
      }
    }
    keys.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    this.allKeys = keys;
    if (onProgress) onProgress(this.keyInfoList.length, this.keyInfoList.length);
    return keys;
  }

  /** List first N resource keys of an MDD (for diagnostics). */
  async sampleResourceKeys(n = 10) {
    if (this.ext !== 'mdd') return [];
    const entries = await this._getKeyBlock(0);
    return entries.slice(0, n).map(e => e.key);
  }

  get stats() {
    return {
      title: this.title,
      version: this.version,
      encoding: this.encoding,
      entries: this.numEntries,
      keyBlocks: this.numKeyBlocks,
      recordBlocks: this.numRecordBlocks,
      sizeMB: (this.blob.size / 1048576).toFixed(1),
    };
  }
}
