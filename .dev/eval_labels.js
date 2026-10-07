(() => {
  const labs = [...document.querySelectorAll('.statc__label')].map(l => ({
    t: l.textContent, lines: Math.round(l.getBoundingClientRect().height / parseFloat(getComputedStyle(l).lineHeight))
  }));
  const f = document.querySelector('.fab');
  return JSON.stringify({labs, fabY: f && Math.round(f.getBoundingClientRect().y), vp: innerHeight});
})()
