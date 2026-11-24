import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const distCandidates = [
  path.join(projectRoot, 'dist', 'ATSSupply-web-app', 'browser'),
  path.join(projectRoot, 'dist', 'ATSSupply-web-app')
];

const distDir = distCandidates.find((dir) => fs.existsSync(dir));

if (!distDir) {
  console.error('[build-sw] Error: dist directory not found. Please run "npm run build" first.');
  process.exit(1);
}

const swTemplatePath = path.join(projectRoot, 'src', 'sw.js');
if (!fs.existsSync(swTemplatePath)) {
  console.error('[build-sw] Error: src/sw.js template not found.');
  process.exit(1);
}

function computeHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
}

function getFilesRecursively(dir, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFilesRecursively(fullPath, baseDir));
    } else if (entry.isFile()) {
      if (
        entry.name.endsWith('.map') ||
        entry.name === 'sw.js' ||
        entry.name === '3rdpartylicenses.txt'
      ) {
        continue;
      }
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const url = relPath.startsWith('/') ? relPath : `/${relPath}`;
      files.push({
        url,
        revision: computeHash(fullPath)
      });
    }
  }

  return files;
}

const precacheFiles = getFilesRecursively(distDir);
const buildTimestamp = Date.now();
const cacheVersion = `ats-supply-v${buildTimestamp}`;

let swContent = fs.readFileSync(swTemplatePath, 'utf-8');
swContent = swContent
  .replace('__CACHE_VERSION__', cacheVersion)
  .replace('__PRECACHE_MANIFEST__', JSON.stringify(precacheFiles, null, 2));

const targetSwPath = path.join(distDir, 'sw.js');
fs.writeFileSync(targetSwPath, swContent, 'utf-8');

console.log(`[build-sw] Successfully generated ${targetSwPath}`);
console.log(`[build-sw] Precached ${precacheFiles.length} assets with cache version: ${cacheVersion}`);
