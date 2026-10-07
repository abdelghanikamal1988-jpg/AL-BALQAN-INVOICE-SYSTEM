(() => {
  const f = document.querySelector('.fab');
  if (!f) return JSON.stringify({missing:true});
  const r = f.getBoundingClientRect();
  const cs = getComputedStyle(f);
  const top = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
  return JSON.stringify({
    rect: {x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height)},
    viewport: {w: innerWidth, h: innerHeight},
    display: cs.display, opacity: cs.opacity, visibility: cs.visibility, zIndex: cs.zIndex,
    bg: cs.backgroundColor, pos: cs.position, bottom: cs.bottom, right: cs.right,
    topEl: top && (top.className || top.tagName)
  });
})()
