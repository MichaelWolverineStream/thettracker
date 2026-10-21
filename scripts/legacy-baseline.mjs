import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const legacy = join(root, 'src/legacy');
const manifestPath = join(legacy, 'legacy-manifest.json');
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const filesIn = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? filesIn(path) : [path];
});
const packagePath = join(root, 'package.json');
const lockPath = join(root, 'package-lock.json');
const lockedVersions = () => Object.fromEntries(Object.entries(readJson(lockPath).packages)
  .filter(([path, entry]) => path && entry.version)
  .map(([path, entry]) => [path, entry.version]));

if (process.argv[2] === 'capture') {
  if (existsSync(legacy)) throw new Error('Legacy already exists; refusing to replace the baseline.');
  mkdirSync(legacy);
  const sources = ['main.tsx', 'App.tsx', 'tracker.tsx', 'launchpage.tsx', 'autotrack.tsx', 'timerContext.tsx', 'components', 'css', 'data'];
  for (const source of sources) cpSync(join(root, 'src', source), join(legacy, source), { recursive: true });
  cpSync(join(root, 'tailwind.config.js'), join(legacy, 'tailwind.baseline.cjs'));
  const manifest = {
    version: '0.0.43-legacy',
    sources: Object.fromEntries(filesIn(legacy).map((path) => [path.slice(legacy.length + 1), hash(path)])),
    shared: Object.fromEntries([
      join(root, 'index.html'), ...filesIn(join(root, 'src/assets')), ...filesIn(join(root, 'public')),
    ].map((path) => [path.slice(root.length), hash(path)])),
    dependencies: readJson(packagePath).dependencies,
    lockedVersions: lockedVersions(),
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

const manifest = readJson(manifestPath);
const withoutContentPaths = (text) => text.replace(/content:\s*\[[\s\S]*?\],/, 'content: [],');
if (withoutContentPaths(readFileSync(join(root, 'tailwind.config.js'), 'utf8')) !==
    withoutContentPaths(readFileSync(join(legacy, 'tailwind.baseline.cjs'), 'utf8'))) {
  throw new Error('Legacy Tailwind settings changed beyond source isolation.');
}
for (const [path, expected] of Object.entries(manifest.sources)) {
  if (hash(join(legacy, path)) !== expected) throw new Error(`Frozen legacy source changed: ${path}`);
}
for (const [path, expected] of Object.entries(manifest.shared)) {
  if (hash(join(root, path)) !== expected) throw new Error(`Legacy asset or document changed: ${path}`);
}
// Re-certification only runs after frozen sources, assets and Tailwind settings verified unchanged.
if (process.argv[2] === 'recertify') {
  manifest.dependencies = readJson(packagePath).dependencies;
  manifest.lockedVersions = lockedVersions();
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('Re-certified legacy dependency declarations and locked versions.');
}
const dependencies = readJson(packagePath).dependencies;
if (JSON.stringify(dependencies) !== JSON.stringify(manifest.dependencies)) throw new Error('Legacy runtime dependency declarations changed.');
const packages = readJson(lockPath).packages;
for (const [path, version] of Object.entries(manifest.lockedVersions)) {
  if (packages[path]?.version !== version) throw new Error(`Baseline locked dependency changed: ${path}`);
}
console.log(`Verified frozen ${manifest.version}: ${Object.keys(manifest.sources).length} source files and all baseline dependencies/assets.`);