/**
 * Embeds the official letterhead into a JS module as a data URI.
 *
 *   npm run letterhead
 *
 * WHY: the PDF is never fetched over the network. Browser extensions /
 * ad-blockers that block "*.pdf" requests (net::ERR_BLOCKED_BY_CLIENT)
 * would otherwise break PDF generation.
 *
 * Source of truth: src/assets/letterhead.pdf  (replace it, then re-run this).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const source = path.join(root, 'src', 'assets', 'letterhead.pdf');
const target = path.join(root, 'src', 'assets', 'letterhead.data.js');

if (!fs.existsSync(source)) {
  console.error('Missing source template:', source);
  process.exit(1);
}

const bytes = fs.readFileSync(source);
const base64 = bytes.toString('base64');

const banner = [
  '/* eslint-disable */',
  '/**',
  ' * AUTO-GENERATED FILE — do not edit by hand.',
  ' * Source: src/assets/letterhead.pdf',
  ' * Regenerate with:  npm run letterhead',
  ' */',
  '',
].join('\n');

fs.writeFileSync(target, `${banner}export default 'data:application/pdf;base64,${base64}';\n`);

console.log(
  `Embedded ${path.relative(root, source)} (${bytes.length} bytes) -> ${path.relative(root, target)} (${fs.statSync(target).size} bytes)`
);
