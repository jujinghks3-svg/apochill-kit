import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'kit-manifest.json'), 'utf8'));
for (const entry of manifest.files) {
  const file = path.resolve(root, entry.path);
  assert(file.startsWith(root), `Path outside kit: ${entry.path}`);
  const buffer = await readFile(file);
  assert.equal(buffer.length, entry.bytes, `Size mismatch: ${entry.path}`);
  assert.equal(createHash('sha256').update(buffer).digest('hex'), entry.sha256, `Hash mismatch: ${entry.path}`);
}
const publicRoot = path.join(root, 'assets/web');
const catalog = JSON.parse(await readFile(path.join(publicRoot, 'gallery/catalog.json'), 'utf8'));
assert(catalog.length > 0);
assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length);
for (const item of catalog) {
  for (const file of [item.model, item.thumbnail, ...item.variants.map(v => v.model)]) {
    assert(manifest.files.some(entry => entry.path === `assets/web/${file}`), `Missing gallery asset: ${file}`);
  }
}
let models = 0;
for (const entry of manifest.files.filter(entry => entry.path.endsWith('.glb'))) {
  const buffer = await readFile(path.join(root, entry.path));
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF', entry.path);
  assert.equal(buffer.readUInt32LE(4), 2, entry.path);
  assert.equal(buffer.readUInt32LE(8), buffer.length, entry.path);
  const json = JSON.parse(buffer.toString('utf8', 20, 20 + buffer.readUInt32LE(12)).trim());
  assert(json.meshes?.length > 0, `Empty GLB: ${entry.path}`);
  for (const asset of [...(json.buffers ?? []), ...(json.images ?? [])]) {
    assert(!asset.uri || asset.uri.startsWith('data:'), `External GLB resource: ${entry.path}`);
  }
  models++;
}
const playlist = JSON.parse(await readFile(path.join(publicRoot, 'audio/bgm/playlist.json'), 'utf8'));
for (const track of playlist.tracks) assert(manifest.files.some(entry => entry.path === `assets/web/audio/bgm/${track.src}`), `Missing music: ${track.src}`);
console.log(`Verified ${manifest.files.length} file hashes, ${catalog.length} gallery entries, ${models} self-contained GLBs, ${playlist.tracks.length} music tracks.`);
execFileSync(process.execPath, ['--test', 'src/activity-state.test.mjs', 'src/activity-phrases.test.mjs', 'src/work-status-ui.test.mjs'], {cwd:root,stdio:'inherit'});
