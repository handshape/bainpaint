// Bainpaint — backend b64 probe (run with: ~/.tinyjs/bin/tjs run tools/probes/b64.mjs)

import { base64Decode } from '../../src/backend/b64.js';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.log(`FAIL  ${name}`); }
}
function eq(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Minimal base64 encoder (test helper).
const ENC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64Encode(bytes) {
  let out = '';
  const n = bytes.length;
  for (let i = 0; i < n; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < n ? bytes[i + 1] : 0;
    const b2 = i + 2 < n ? bytes[i + 2] : 0;
    out += ENC[b0 >> 2];
    out += ENC[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < n ? ENC[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < n ? ENC[b2 & 63] : '=';
  }
  return out;
}

console.log('== known vectors ==');
check('empty', eq(base64Decode(''), new Uint8Array(0)));
// Well-known independent anchors (not produced by the local encoder).
check('"YWJj" -> abc', eq(base64Decode('YWJj'), new Uint8Array([97, 98, 99])));
check('"TWFu" -> Man', eq(base64Decode('TWFu'), new Uint8Array([77, 97, 110])));
check('"c2VjcmV0" -> secret', eq(base64Decode('c2VjcmV0'),
  new Uint8Array([115, 101, 99, 114, 101, 116])));
// Roundtrip encode->decode for all lengths 0..64 (exercises all padding cases).
check('roundtrip lengths 0..64', (() => {
  for (let n = 0; n <= 64; n++) {
    const buf = new Uint8Array(n);
    for (let i = 0; i < n; i++) buf[i] = (i * 37 + 11) & 0xff;
    if (!eq(base64Decode(b64Encode(buf)), buf)) return false;
  }
  return true;
})());
check('all 256 bytes encode/decode', (() => {
  const all = new Uint8Array(256);
  for (let i = 0; i < 256; i++) all[i] = i;
  return eq(base64Decode(b64Encode(all)), all);
})());

console.log('== 1 MB roundtrip ==');
{
  const N = 1024 * 1024;
  const buf = new Uint8Array(N);
  // Deterministic pseudo-random (xorshift) so the test is reproducible.
  let s = 0x2f6e2b1;
  for (let i = 0; i < N; i++) {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    buf[i] = s & 0xff;
  }
  const enc = b64Encode(buf);
  check('1 MB base64 length', enc.length === 4 * Math.ceil(N / 3));
  const t0 = Date.now ? Date.now() : 0;
  const dec = base64Decode(enc);
  check('1 MB decode length', dec.length === N);
  check('1 MB roundtrip equal', eq(dec, buf));
}

console.log('== tjs:base64 availability ==');
{
  let available = false, how = 'none';
  try {
    const m = await import('tjs:base64');
    available = true;
    how = Object.keys(m).join(',');
  } catch (e) {
    how = 'import rejected: ' + ((e && e.message) || e);
  }
  console.log(`  tjs:base64 available? ${available} (${how})`);
  // Record outcome for the record (no assertion — either is acceptable).
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) tjs.exit(1);
