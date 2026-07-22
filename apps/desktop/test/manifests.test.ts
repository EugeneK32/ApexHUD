import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateModuleManifest } from '@apexhud/protocol';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
const modulesRoot = path.join(repositoryRoot, 'modules');

describe('built-in modules', () => {
  it('have valid manifests and existing entry points', async () => {
    const directories = (await readdir(modulesRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'));

    expect(directories.length).toBeGreaterThanOrEqual(2);
    for (const directory of directories) {
      const root = path.join(modulesRoot, directory.name);
      const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')) as unknown;
      const validation = validateModuleManifest(manifest);
      expect(validation.errors, directory.name).toEqual([]);
      if (!validation.valid) continue;

      const entry = await stat(path.resolve(root, manifest.entry));
      expect(entry.isFile(), `${directory.name}/${manifest.entry}`).toBe(true);
    }
  });

  it('uses unique module ids', async () => {
    const directories = (await readdir(modulesRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'));
    const ids: string[] = [];
    for (const directory of directories) {
      const raw = await readFile(path.join(modulesRoot, directory.name, 'manifest.json'), 'utf8');
      ids.push((JSON.parse(raw) as { id: string }).id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});
