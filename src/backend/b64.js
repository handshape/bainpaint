// Bainpaint backend — base64 decoder (pure ESM module, probeable).
//
// Used to decode chunked image payloads. txiki.js 26.6 does not expose a
// typed `tjs:base64` module, so this pure-JS decoder is the default path.
// (A runtime probe records whether `import('tjs:base64')` resolves; if it
// ever does, main.js can prefer it.)

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const LOOKUP = new Int8Array(256).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;
// URL-safe variants (defensive).
LOOKUP['-'.charCodeAt(0)] = 62;
LOOKUP['_'.charCodeAt(0)] = 63;

/**
 * Decode a base64 string (standard or URL-safe, whitespace tolerated) to a
 * Uint8Array. Uses a 6-bit accumulator so '=' padding is handled implicitly.
 * @param {string} s
 * @returns {Uint8Array}
 */
export function base64Decode(s) {
  const bytes = new Uint8Array((s.length * 6) >> 3);
  let oi = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    // Skip whitespace.
    if (c === 13 || c === 10 || c === 32 || c === 9) continue;
    if (c === 61) break; // '='
    const v = LOOKUP[c];
    if (v < 0) continue; // defensive: skip invalid char
    acc = (acc << 6) | v;
    bits += 6;
    while (bits >= 8) {
      bits -= 8;
      bytes[oi++] = (acc >> bits) & 0xff;
      // Keep only the not-yet-consumed low bits.
      acc &= (1 << bits) - 1;
    }
  }
  return oi === bytes.length ? bytes : bytes.subarray(0, oi);
}
