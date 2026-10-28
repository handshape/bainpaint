// Unit tests for the backend base64 decoder (pure ESM, no tjs).
// Run with: node --test test/b64.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base64Decode } from '../src/backend/b64.js';

test('b64: empty string', () => {
  const r = base64Decode('');
  assert.equal(r.length, 0);
});

test('b64: known vectors', () => {
  const cases = [
    ['YWJj', 'abc'],
    ['TWFu', 'Man'],
    ['c2VjcmV0', 'secret'],
    ['aGVsbG8gd29ybGQ=', 'hello world'],
    ['Kw==', '+'],
  ];
  for (const [b64, expected] of cases) {
    const r = base64Decode(b64);
    const s = new TextDecoder().decode(r);
    assert.equal(s, expected, `decode('${b64}')`);
  }
});

test('b64: all 256 byte values roundtrip', () => {
  const bytes = new Uint8Array(256);
  for (let i = 0; i < 256; i++) bytes[i] = i;
  // Encode to base64 (Node has btoa for this).
  const b64 = Buffer.from(bytes).toString('base64');
  const decoded = base64Decode(b64);
  assert.equal(decoded.length, 256);
  for (let i = 0; i < 256; i++) assert.equal(decoded[i], i);
});

test('b64: roundtrip lengths 0..64', () => {
  for (let len = 0; len <= 64; len++) {
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = i * 7 % 256;
    const b64 = Buffer.from(bytes).toString('base64');
    const decoded = base64Decode(b64);
    assert.equal(decoded.length, len, `len ${len}`);
    for (let i = 0; i < len; i++) {
      assert.equal(decoded[i], bytes[i], `byte ${i} of len ${len}`);
    }
  }
});

test('b64: 1 MB roundtrip', () => {
  const size = 1024 * 1024;
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = i % 256;
  const b64 = Buffer.from(bytes).toString('base64');
  assert.equal(b64.length, Math.ceil(size / 3) * 4);
  const decoded = base64Decode(b64);
  assert.equal(decoded.length, size);
  for (let i = 0; i < size; i++) {
    if (decoded[i] !== bytes[i]) {
      assert.fail(`mismatch at byte ${i}: got ${decoded[i]}, want ${bytes[i]}`);
    }
  }
});

test('b64: whitespace tolerated', () => {
  const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const b64 = Buffer.from(bytes).toString('base64');
  // Insert newlines every 4 chars (MIME-style).
  const withNewlines = b64.match(/.{1,4}/g).join('\n');
  const decoded = base64Decode(withNewlines);
  assert.equal(decoded.length, 9);
  for (let i = 0; i < 9; i++) assert.equal(decoded[i], bytes[i]);
});

test('b64: URL-safe variant', () => {
  // '+' (0x2b) encodes to '+A==' in standard, '-A==' in URL-safe... actually:
  // 0x2b = 00101011 → 6-bit groups: 001010 11xxxx → '+' is index 62.
  // URL-safe uses '-' for index 62.
  const b64Std = Buffer.from([0xfb, 0xff, 0xbf]).toString('base64');
  const b64Url = b64Std.replace(/\+/g, '-').replace(/\//g, '_');
  const d1 = base64Decode(b64Std);
  const d2 = base64Decode(b64Url);
  assert.equal(d1.length, 3);
  assert.equal(d2.length, 3);
  assert.equal(d1[0], d2[0]);
  assert.equal(d1[1], d2[1]);
  assert.equal(d1[2], d2[2]);
});
