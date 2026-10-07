(() => {
  const f = document.querySelector('.fab');
  const out = [];
  let el = f.parentElement;
  while (el && el !== document.documentElement) {
    const cs = getComputedStyle(el);
    const props = {transform: cs.transform, filter: cs.filter, backdropFilter: cs.backdropFilter,
      perspective: cs.perspective, willChange: cs.willChange, contain: cs.contain, position: cs.position};
    const hit = Object.entries(props).filter(([k,v]) => v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px' && v !== 'normal 0%');
    if (hit.length) out.push({tag: el.tagName + '.' + (el.className||'').split(' ').slice(0,2).join('.'), hit: Object.fromEntries(hit)});
    el = el.parentElement;
  }
  return JSON.stringify(out, null, 1);
})()
