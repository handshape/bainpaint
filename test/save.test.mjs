// Integration tests for the backend chunked save path (requires tjs).
// Run with: ~/.tinyjs/bin/tjs run test/save.test.mjs
//
// tjs (QuickJS) has no node:test, so this uses a minimal check() harness
// matching the style of tools/probes/.

import { api } from '../src/backend/main.js';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.log(`FAIL  ${name}`); }
}

// Compact base64 encoder (test helper).
const ENC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64Encode(bytes) {
  let out = '';
  const n = bytes.length;
  for (let i = 0; i < n; i += 3) {
    const b0 = bytes[i], b1 = i + 1 < n ? bytes[i + 1] : 0, b2 = i + 2 < n ? bytes[i + 2] : 0;
    out += ENC[b0 >> 2] + ENC[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < n ? ENC[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < n ? ENC[b2 & 63] : '=';
  }
  return out;
}

function eqBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function chunkB64(b64, maxBinary) {
  const maxChars = Math.ceil(maxBinary / 3) * 4;
  const chunks = [];
  for (let i = 0; i < b64.length; i += maxChars) {
    chunks.push(b64.slice(i, i + maxChars));
  }
  return chunks;
}

const TMP_DIR = tjs.tmpDir + '/bainpaint-test';
await tjs.makeDir(TMP_DIR, { recursive: true });
const TEST_FILE = `${TMP_DIR}/save-test.png`;
const AUTOSAVE_FILE = `${TMP_DIR}/autosave.png`;

// ---- saveImage: single-chunk small file -----------------------------------
console.log('== saveImage single-chunk small ==');
{
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4, 5]);
  const b64 = b64Encode(bytes);
  const result = await api.saveImage({ path: TEST_FILE, b64, i: 0, n: 1 });
  check('ok', result.ok);
  const read = await tjs.readFile(TEST_FILE);
  check('byte-identical', eqBytes(read, bytes));
  try {
    await tjs.stat(TEST_FILE + '.part');
    check('.part cleaned up', false);
  } catch {
    check('.part cleaned up', true);
  }
}

// ---- saveImage: chunked >1 MB roundtrip ------------------------------------
console.log('== saveImage chunked >1 MB ==');
{
  const size = 1500000;
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = i % 256;
  const b64 = b64Encode(bytes);
  const chunks = chunkB64(b64, 512 * 1024);
  check('multiple chunks', chunks.length > 1);

  let allOk = true;
  for (let i = 0; i < chunks.length; i++) {
    const result = await api.saveImage({ path: TEST_FILE, b64: chunks[i], i, n: chunks.length });
    if (!result.ok) { allOk = false; break; }
  }
  check('all chunks ok', allOk);

  const read = await tjs.readFile(TEST_FILE);
  check('length matches', read.length === size);
  check('byte-identical', eqBytes(read, bytes));
  console.log(`  (streamed ${chunks.length} chunks, ${size} bytes)`);
}

// ---- autosave: chunked save + load + clear ---------------------------------
console.log('== autosave chunked + load + clear ==');
{
  const mockApp = {
    paths: async () => ({ data: TMP_DIR }),
  };

  const size = 2000000;
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = i % 256;
  const b64 = b64Encode(bytes);
  const chunks = chunkB64(b64, 512 * 1024);
  check('autosave >1 chunk', chunks.length > 1);

  for (let i = 0; i < chunks.length; i++) {
    await api.autosaveSave({ b64: chunks[i], i, n: chunks.length }, mockApp);
  }

  const info = await api.autosaveLoad({}, mockApp);
  check('autosaveLoad found', !!info);
  check('autosave path correct', info && info.path.includes('autosave.png'));
  check('autosave size > 0', info && info.size > 0);

  const read = await tjs.readFile(`${TMP_DIR}/autosave.png`);
  check('autosave byte-identical', eqBytes(read, bytes));

  await api.autosaveClear({}, mockApp);
  const after = await api.autosaveLoad({}, mockApp);
  check('autosaveLoad null after clear', after === null);
}

// ---- cleanup -----------------------------------------------------------------
try { await tjs.remove(TEST_FILE); } catch {}
try { await tjs.remove(TEST_FILE + '.part'); } catch {}
try { await tjs.remove(AUTOSAVE_FILE); } catch {}
try { await tjs.remove(AUTOSAVE_FILE + '.part'); } catch {}
try { await tjs.remove(TMP_DIR); } catch {}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
