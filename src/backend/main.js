// Bainpaint backend — runs on txiki.js (QuickJS) with full system access.
//
// The page owns all pixel work. The backend only: writes image bytes to disk
// (chunked base64, see §3.2 of the plan), manages the autosave file, and
// reports sysinfo. File *opening* never touches bytes here — the page loads
// images itself via tiny.fileURL(path) + <img>.
//
// Every function in `api` is callable from the page:
//   await tiny.api.call('name', params)

import { base64Decode } from './b64.js';

// txiki.js 26.6 exposes no typed `tjs:base64` (verified by tools/probes/b64.mjs),
// so the bundled pure-JS decoder is the path of record.
const decode = base64Decode;

/**
 * Shared chunked writer. The page sends the file as `n` base64 chunks of at
 * most ~512 KB of binary each (the bridge has no documented max message size,
 * so we bound it). Chunk i===0 creates/truncates the .part temp in the target
 * directory; later chunks append; the last chunk renames .part into place.
 */
async function writeChunk(targetPath, b64, i, n) {
  const part = targetPath + '.part';
  const data = decode(b64);
  const h = await tjs.open(part, i === 0 ? 'w' : 'a');
  try {
    await h.write(data);
  } finally {
    await h.close();
  }
  if (i === n - 1) {
    await tjs.rename(part, targetPath);
  }
  return { ok: true };
}

// The current print/PDF job, shared between the main page (sets it) and the
// throwaway print.html window (reads it). Both windows share this backend.
let printJob = null;

export const api = {
  // Save an image to `path`. { path, b64, i, n } per chunk.
  saveImage: async ({ path, b64, i, n }) => writeChunk(path, b64, i, n),

  // Print/PDF job hand-off (main page -> print.html window).
  setPrintJob: ({ path, mode, pdfPath }) => { printJob = { path, mode, pdfPath }; return { ok: true }; },
  getPrintJob: () => printJob,

  // Autosave to <data>/autosave.png, same chunking.
  autosaveSave: async ({ b64, i, n }, app) => {
    const { data } = await app.paths();
    await tjs.makeDir(data, { recursive: true });
    return writeChunk(`${data}/autosave.png`, b64, i, n);
  },

  // { path, mtime } of the autosave file, or null if absent.
  autosaveLoad: async (params, app) => {
    const { data } = await app.paths();
    const path = `${data}/autosave.png`;
    try {
      const st = await tjs.stat(path);
      return { path, mtime: st.mtim ? st.mtim.getTime() : 0, size: st.size };
    } catch {
      return null;
    }
  },

  autosaveClear: async (params, app) => {
    const { data } = await app.paths();
    const path = `${data}/autosave.png`;
    try { await tjs.remove(path); } catch { /* absent is fine */ }
    try { await tjs.remove(path + '.part'); } catch { /* absent is fine */ }
    return { ok: true };
  },

  // For the About dialog / status.
  sysinfo: () => ({
    user: tjs.system.userInfo.userName,
    cwd: tjs.cwd,
    cpus: tjs.system.cpus.length,
    version: tjs.version,
    hostName: tjs.hostName,
  }),

  // Keep for parity with the scaffold's ping.
  ping: () => 'pong',
};

// Called once the window is up.
export function init(app) {
  app.setTitle('Bainpaint');
}
