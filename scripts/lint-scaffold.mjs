import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcAppDir = path.join(projectRoot, 'src', 'app');

const errors = [];

// 1. Check layout existence
const requiredLayouts = [
  path.join(srcAppDir, 'auth', 'auth-layout', 'auth-layout.component.ts'),
  path.join(srcAppDir, 'admin', 'application', 'application-layout', 'application-layout.component.ts'),
  path.join(srcAppDir, 'admin', 'user', 'user-layout', 'user-layout.component.ts')
];

for (const layoutPath of requiredLayouts) {
  if (!fs.existsSync(layoutPath)) {
    errors.push(`Missing mandatory layout: ${path.relative(projectRoot, layoutPath)}`);
  }
}

// 2. Scan src/app for prohibited .css files (must be .scss)
function scanForCssFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanForCssFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.css')) {
      errors.push(`Prohibited custom .css file found (must use .scss): ${path.relative(projectRoot, fullPath)}`);
    }
  }
}
scanForCssFiles(srcAppDir);

// 3. Scan interfaces in src/app/core/interfaces/
const interfacesDir = path.join(srcAppDir, 'core', 'interfaces');
if (fs.existsSync(interfacesDir)) {
  const entityFolders = fs.readdirSync(interfacesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'common');

  for (const folder of entityFolders) {
    const entityName = folder.name;
    const folderPath = path.join(interfacesDir, entityName);
    const requiredFiles = [
      `${entityName}.interface.ts`,
      `${entityName}-results.interface.ts`,
      `${entityName}-single-result.interface.ts`,
      'index.ts'
    ];

    for (const reqFile of requiredFiles) {
      const filePath = path.join(folderPath, reqFile);
      if (!fs.existsSync(filePath)) {
        errors.push(`Missing interface file: ${path.relative(projectRoot, filePath)}`);
      }
    }
  }
}

// 4. Verify pipes are ONLY in src/app/shared/pipes
function scanForPipes(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanForPipes(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.pipe.ts')) {
      const allowedDir = path.join(srcAppDir, 'shared', 'pipes');
      if (!fullPath.startsWith(allowedDir)) {
        errors.push(`Pipe placed outside shared/pipes: ${path.relative(projectRoot, fullPath)}`);
      }
    }
  }
}
scanForPipes(srcAppDir);

// 5. Scan for forbidden deep relative imports (e.g., ../../core/ or ../../shared/)
function scanForForbiddenImports(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanForForbiddenImports(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'))) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const forbiddenPattern = /from\s+['"](?:\.\.\/)+(?:core|shared)\/[^'"]+['"]/g;
      if (forbiddenPattern.test(content)) {
        errors.push(`Prohibited relative import with backtracking instead of path alias: ${path.relative(projectRoot, fullPath)}`);
      }
    }
  }
}
scanForForbiddenImports(srcAppDir);

if (errors.length > 0) {
  console.error('[lint:scaffold] FAILED with following errors:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
} else {
  console.log('[lint:scaffold] PASSED: All scaffolding and architecture rules are valid.');
}
