// Builds public/google-fonts/catalog.json: the Google Fonts families the app
// can import, pinned to one google/fonts commit so every import is reproducible.
//
//   node tools/build-google-catalog.mjs [commit]   (default: google/fonts main)
//   node tools/build-google-catalog.mjs --check    validate the committed file
//
// Sources (no API key): the google/fonts git tree (file paths + sizes) and the
// public fonts.google.com/metadata/fonts list (category, designers, subsets).
// Kept: OFL families (ofl/ directory) with a Latin subset and at least one
// .ttf of at most MAX_BYTES. Apache/UFL families are left out because the
// export path enforces SIL OFL rules.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'public/google-fonts/catalog.json');
const MAX_BYTES = 3 * 1024 * 1024;
const WEIGHTS = { Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900 };
export const FILE_RE = /^[A-Za-z0-9_-]+(\[[A-Za-z,]+\])?\.ttf$/;

// "Inter[opsz,wght].ttf" → "Variable · opsz, wght"; "Lato-BoldItalic.ttf" → "Bold Italic"
export function styleLabel(file) {
  const axes = file.match(/\[([^\]]+)\]/);
  const italic = /Italic/.test(file.replace(/\[.*$/, ''));
  if (axes) return `Variable${italic ? ' Italic' : ''} · ${axes[1].split(',').join(', ')}`;
  const style = (file.replace(/\.ttf$/, '').split('-').pop() || 'Regular').replace(/Italic$/, '');
  const name = style in WEIGHTS ? style.replace(/([a-z])([A-Z])/g, '$1 $2') : style === '' ? 'Regular' : style;
  return `${italic && name === 'Regular' ? '' : name}${italic ? `${name === 'Regular' ? '' : ' '}Italic` : ''}` || 'Regular';
}
const order = (file) => {
  if (/\[/.test(file)) return (/Italic/.test(file) ? 1 : 0);
  const style = file.replace(/\.ttf$/, '').split('-').pop().replace(/Italic$/, '') || 'Regular';
  return 10 + (WEIGHTS[style] ?? 450) / 10 + (/Italic/.test(file) ? 0.5 : 0);
};

function validate(catalog) {
  if (!/^[0-9a-f]{40}$/.test(catalog.commit)) throw Error('commit must be a 40-char sha');
  if (!Array.isArray(catalog.families) || catalog.families.length < 1000) throw Error('too few families');
  const seen = new Set();
  for (const f of catalog.families) {
    if (!/^[a-z0-9]+$/.test(f.dir) || seen.has(f.dir)) throw Error(`bad or duplicate dir ${f.dir}`);
    seen.add(f.dir);
    if (typeof f.n !== 'string' || !f.n || f.n.length > 64) throw Error(`bad name in ${f.dir}`);
    if (!f.files.length) throw Error(`${f.dir} has no files`);
    for (const [file, label, size] of f.files) if (!FILE_RE.test(file) || typeof label !== 'string' || !(size > 0 && size <= MAX_BYTES)) throw Error(`bad file ${f.dir}/${file}`);
  }
  return catalog;
}

if (process.argv.includes('--check')) {
  const c = validate(JSON.parse(fs.readFileSync(out, 'utf8')));
  console.log(`catalog ok: ${c.families.length} families at google/fonts@${c.commit.slice(0, 7)}`);
  process.exit(0);
}

const get = async (url, json = true) => { const r = await fetch(url, { headers: { 'User-Agent': 'darkskyforge-catalog' } }); if (!r.ok) throw Error(`${url}: HTTP ${r.status}`); return json ? r.json() : r.text(); };
const commit = process.argv[2] || (await get('https://api.github.com/repos/google/fonts/commits/main')).sha;
const tree = await get(`https://api.github.com/repos/google/fonts/git/trees/${commit}?recursive=1`);
if (tree.truncated) throw Error('git tree was truncated');
const raw = await get('https://fonts.google.com/metadata/fonts', false);
const meta = JSON.parse(raw.slice(raw.indexOf('{'))).familyMetadataList;

const dirs = new Map();
for (const t of tree.tree) {
  const m = t.path.match(/^ofl\/([a-z0-9]+)\/([^/]+)$/);
  if (!m) continue;
  if (!dirs.has(m[1])) dirs.set(m[1], { files: [], license: false });
  if (m[2] === 'OFL.txt') dirs.get(m[1]).license = true;
  else if (FILE_RE.test(m[2]) && t.size <= MAX_BYTES) dirs.get(m[1]).files.push([m[2], styleLabel(m[2]), t.size]);
}
const families = [];
for (const f of meta.slice().sort((a, b) => a.popularity - b.popularity)) {
  const dir = f.family.toLowerCase().replace(/[^a-z0-9]/g, '');
  const entry = dirs.get(dir);
  if (!entry || !entry.license || !entry.files.length || !f.subsets.includes('latin')) continue;
  entry.files.sort((a, b) => order(a[0]) - order(b[0]));
  families.push({ n: f.family, c: f.category, d: (f.designers || []).slice(0, 3).join(', '), dir, files: entry.files });
}
const catalog = validate({ commit, generated: new Date().toISOString().slice(0, 10), source: 'https://github.com/google/fonts', families });
fs.writeFileSync(out, JSON.stringify(catalog));
console.log(`wrote ${families.length} families at google/fonts@${commit.slice(0, 7)} (${(fs.statSync(out).size / 1024).toFixed(0)} kB)`);
