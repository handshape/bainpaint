// Bainpaint — backend saveImage chunked-path probe.
// run with: ~/.tinyjs/bin/tjs run tools/probes/save.mjs
//
// Drives api.saveImage directly in the real backend runtime: encodes a >1 MB
// synthetic blob to base64, splits it into <=512 KB binary chunks, streams the
// chunks, then reads the file back and verifies it is byte-identical.

import { api } from '../../src/backend/main.js';
import { base64Decode } from '../../src/backend/b64.js';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.log(`FAIL  ${name}`); }
}
function eqBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
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

// Split a base64 string into chunks so each chunk decodes to <= maxBinary bytes.
// We chunk on the *encoded* string by a byte budget: base64 is 4 chars per 3
// bytes, so a binary budget B maps to ceil(B/3)*4 chars. To guarantee the
// decoded chunk is <= maxBinary, chunk the ENCODED string in multiples of 4
// chars sized so decoded bytes <= maxBinary.
function chunkB64(b64, maxBinary) {
  // Floor (not ceil) so the decoded chunk stays <= maxBinary bytes.
  const charsPerChunk = Math.max(4, 4 * Math.floor(maxBinary / 3));
  const chunks = [];
  for (let i = 0; i < b64.length; i += charsPerChunk) {
    chunks.push(b64.slice(i, i + charsPerChunk));
  }
  return chunks;
}

const MAX_CHUNK_BINARY = 512 * 1024;

console.log('== saveImage chunked roundtrip (>1 MB) ==');
{
  const N = 1.5 * 1024 * 1024 | 0; // 1.5 MiB
  const blob = new Uint8Array(N);
  let s = 0x9e3779b9;
  for (let i = 0; i < N; i++) { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; blob[i] = s & 0xff; }

  const dir = tjs.cwd;
  const target = `${dir}/.save-probe-big.bin`;
  const b64 = b64Encode(blob);
  const chunks = chunkB64(b64, MAX_CHUNK_BINARY);
  check('more than one chunk', chunks.length > 1);
  // Verify each chunk decodes to <= MAX_CHUNK_BINARY.
  check('each chunk <= 512 KiB binary', chunks.every((c) => base64Decode(c).length <= MAX_CHUNK_BINARY));

  for (let i = 0; i < chunks.length; i++) {
    const r = await api.saveImage({ path: target, b64: chunks[i], i, n: chunks.length });
    if (!r || !r.ok) { check(`chunk ${i} ok`, false); break; }
  }
  const back = await tjs.readFile(target);
  check('file exists & byte-identical', eqBytes(new Uint8Array(back), blob));
  check('file size matches', back.length === N);
  // No lingering .part.
  let partGone = true;
  try { await tjs.stat(target + '.part'); partGone = false; } catch {}
  check('.part cleaned up', partGone);
  await tjs.remove(target).catch(() => {});
  console.log(`  (streamed ${chunks.length} chunks, ${N} bytes)`);
}

console.log('== saveImage single-chunk small ==');
{
  const blob = new Uint8Array([1, 2, 3, 4, 5]);
  const target = `${tjs.cwd}/.save-probe-small.bin`;
  const b64 = b64Encode(blob);
  const r = await api.saveImage({ path: target, b64, i: 0, n: 1 });
  check('ok', r && r.ok);
  const back = await tjs.readFile(target);
  check('byte-identical', eqBytes(new Uint8Array(back), blob));
  await tjs.remove(target).catch(() => {});
}

console.log('== autosaveSave chunked + load + clear ==');
{
  const dataDir = `${tjs.cwd}/.autosave-probe`;
  const fakeApp = { paths: async () => ({ data: dataDir }) };
  await tjs.makeDir(dataDir, { recursive: true });
  const N = 700 * 1024; // 700 KiB -> 2 chunks
  const blob = new Uint8Array(N);
  for (let i = 0; i < N; i++) blob[i] = (i & 0xff);
  const b64 = b64Encode(blob);
  const chunks = chunkB64(b64, MAX_CHUNK_BINARY);
  check('autosave >1 chunk', chunks.length > 1);
  for (let i = 0; i < chunks.length; i++) {
    await api.autosaveSave({ b64: chunks[i], i, n: chunks.length }, fakeApp);
  }
  const info = await api.autosaveLoad({}, fakeApp);
  check('autosaveLoad found', !!info && info.path.endsWith('autosave.png'));
  const back = await tjs.readFile(info.path);
  check('autosave byte-identical', eqBytes(new Uint8Array(back), blob));
  await api.autosaveClear({}, fakeApp);
  const after = await api.autosaveLoad({}, fakeApp);
  check('autosaveLoad null after clear', after === null);
  await tjs.remove(dataDir).catch(() => {});
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) tjs.exit(1);
