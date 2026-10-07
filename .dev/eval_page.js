(() => {
  const p = document.querySelector('.page');
  const f = document.querySelector('.fab');
  const cs = p && getComputedStyle(p);
  return JSON.stringify({
    pageTransform: cs && cs.transform,
    pageAnim: cs && cs.animation,
    pageRect: p && {top: Math.round(p.getBoundingClientRect().top), h: Math.round(p.getBoundingClientRect().height)},
    fabRect: f && {y: Math.round(f.getBoundingClientRect().y)},
    vp: {w: innerWidth, h: innerHeight}
  });
})()
