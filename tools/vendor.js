// Copies frontend assets out of node_modules into src/frontend/vendor/.
// The vendored files are committed to the repo; the app has no CDN and no
// build step at runtime. Re-run after bumping a devDependency:
//   pnpm run vendor          # lucide only
//   pnpm run build:ui        # lucide + recompiled tailwind css
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const vendor = join(root, 'src/frontend/vendor');
mkdirSync(vendor, { recursive: true });

const lucide = require('lucide/package.json');
copyFileSync(join(root, 'node_modules/lucide/dist/umd/lucide.min.js'), join(vendor, 'lucide.min.js'));
copyFileSync(join(root, 'node_modules/lucide/dist/umd/lucide.min.js.map'), join(vendor, 'lucide.min.js.map'));
console.log(`vendored lucide v${lucide.version} -> src/frontend/vendor/`);
