import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateModuleManifest } from '../packages/protocol/dist/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modulesRoot = path.join(root, 'modules');
let failures = 0;

for (const entry of await readdir(modulesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
  const moduleRoot = path.join(modulesRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(path.join(moduleRoot, 'manifest.json'), 'utf8'));
    const validation = validateModuleManifest(manifest);
    if (!validation.valid) {
      failures++;
      console.error(`${entry.name}: ${validation.errors.join('; ')}`);
      continue;
    }
    const target = path.resolve(moduleRoot, manifest.entry);
    const info = await stat(target);
    if (!info.isFile()) throw new Error(`entry is not a file: ${manifest.entry}`);
    console.log(`ok  ${manifest.id}`);
  } catch (error) {
    failures++;
    console.error(`${entry.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) process.exit(1);
