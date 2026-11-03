import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, 'dist');
const required = [
  'index.html',
  'display/index.html',
  'assets',
  'public/manus-routes.json',
];

const missing = required.filter((path) => {
  const absolute = join(root, path);
  return !existsSync(absolute) || (path === 'assets' && !statSync(absolute).isDirectory());
});

if (missing.length > 0) {
  console.error(`Build failed: required project file${missing.length === 1 ? '' : 's'} missing or invalid:\n${missing.map((path) => `  - ${path}`).join('\n')}`);
  process.exitCode = 1;
} else {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });

  cpSync(join(root, 'index.html'), join(output, 'index.html'));
  cpSync(join(root, 'display'), join(output, 'display'), { recursive: true });
  cpSync(join(root, 'assets'), join(output, 'assets'), { recursive: true });
  cpSync(join(root, 'public/manus-routes.json'), join(output, 'manus-routes.json'));

  console.log(`Static site built successfully: ${output}`);
}
