// Vercel CLI's default deploy (`vercel deploy <dir>`) always skips any
// directory literally named "node_modules" anywhere in the tree, regardless
// of .vercelignore — Expo's web export puts font/vector-icon assets under
// dist/assets/node_modules/..., so those files silently never upload and the
// app falls back to system fonts in production. Renaming the directory and
// rewriting the matching path string in the exported files avoids the name
// Vercel special-cases.
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const OLD_SEGMENT = 'assets/node_modules';
const NEW_SEGMENT = 'assets/vendor';

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function main() {
  const oldDir = path.join(DIST_DIR, 'assets', 'node_modules');
  const newDir = path.join(DIST_DIR, 'assets', 'vendor');

  if (!fs.existsSync(oldDir)) {
    console.log('No dist/assets/node_modules directory found — nothing to fix.');
    return;
  }

  fs.renameSync(oldDir, newDir);
  console.log(`Renamed ${oldDir} -> ${newDir}`);

  let patchedCount = 0;
  for (const file of walk(DIST_DIR)) {
    if (!/\.(js|html|css|json)$/i.test(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes(OLD_SEGMENT)) continue;
    fs.writeFileSync(file, content.split(OLD_SEGMENT).join(NEW_SEGMENT));
    patchedCount += 1;
  }
  console.log(`Patched ${patchedCount} file(s) referencing "${OLD_SEGMENT}".`);

  // `vercel deploy ./dist` treats dist/ as the deploy root, so a vercel.json
  // sitting at the repo root (next to package.json) is never read — it has
  // to be copied inside the directory that's actually handed to the CLI.
  const vercelConfigSrc = path.join(ROOT_DIR, 'vercel.json');
  const vercelConfigDest = path.join(DIST_DIR, 'vercel.json');
  fs.copyFileSync(vercelConfigSrc, vercelConfigDest);
  console.log(`Copied vercel.json -> ${vercelConfigDest}`);
}

main();
