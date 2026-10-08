(async()=>{
await new Promise((r) => setTimeout(r, 2500));
const g = (s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  const c = getComputedStyle(e);
  return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), x: +r.x.toFixed(1), y: +r.y.toFixed(1), fs: c.fontSize, fw: c.fontWeight, bg: c.backgroundColor, rad: c.borderRadius, disp: c.display };
};
const kids = (s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  return [...e.children].map((k) => {
    const r = k.getBoundingClientRect();
    const c = getComputedStyle(k);
    return { tag: k.tagName + '.' + (k.className || '').toString().split(' ').slice(0, 2).join('.'), w: +r.width.toFixed(1), h: +r.height.toFixed(1), x: +r.x.toFixed(1), y: +r.y.toFixed(1), disp: c.display };
  });
};
const cs = getComputedStyle(document.documentElement);
return JSON.stringify({
  header: g('header.navbar'),
  headerPad: getComputedStyle(document.querySelector('header.navbar')).padding,
  inner: kids('header.navbar > .container-xl'),
  menu: g('header .nx-tool'),
  newBtn: g('header .btn-primary'),
  search: g('.nx-search'),
  input: g('.nx-search .form-control'),
  chip: g('.nx-user-chip'),
  chipKids: kids('.nx-user-chip'),
  vr: g('header .vr'),
  card: g('.card'),
  cardHeader: g('.card-header'),
  cardTitle: g('.card-title'),
  h2: g('.h2'),
  stat: g('.nx-stat'),
  statTile: g('.nx-icon-tile'),
  spark: g('.nx-stat-spark'),
  body: { fs: getComputedStyle(document.body).fontSize, ff: getComputedStyle(document.body).fontFamily.slice(0, 70) },
  vars: { radiusLg: cs.getPropertyValue('--tblr-border-radius-lg'), border: cs.getPropertyValue('--tblr-border-color-translucent'), shadow: (cs.getPropertyValue('--tblr-shadow-card') || '').slice(0, 90), surf2: cs.getPropertyValue('--tblr-bg-surface-secondary'), accent: cs.getPropertyValue('--accent') }
}, null, 1); return 1;})()