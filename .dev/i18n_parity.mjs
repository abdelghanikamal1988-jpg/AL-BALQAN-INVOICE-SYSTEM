import en from '../src/i18n/en.js';
import ar from '../src/i18n/ar.js';

function flat(o, p = '', out = {}) {
  for (const [k, v] of Object.entries(o)) {
    const key = p ? p + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out);
    else out[key] = v;
  }
  return out;
}

const fe = flat(en);
const fa = flat(ar);
const ek = Object.keys(fe).sort();
const ak = Object.keys(fa).sort();
const missingInAr = ek.filter((k) => !fa[k]);
const missingInEn = ak.filter((k) => !fe[k]);
console.log('en keys:', ek.length, '| ar keys:', ak.length);
console.log('missing in ar:', missingInAr.length, missingInAr.slice(0, 40));
console.log('missing in en:', missingInEn.length, missingInEn.slice(0, 40));
