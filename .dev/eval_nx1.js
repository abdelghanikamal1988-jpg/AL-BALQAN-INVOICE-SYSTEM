(() => {
  const g = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      x: Math.round(r.x), y: Math.round(r.y),
      w: Math.round(r.width), h: Math.round(r.height),
      disp: cs.display, vis: cs.visibility,
    };
  };
  return {
    vw: window.innerWidth,
    header: g('.app-header'),
    menu: g('.app-header__menu'),
    brand: g('.app-header__brand'),
    search: g('.topsearch__input'),
    cta: g('.app-header__cta'),
    tool: g('.app-header__tool'),
    bell: g('.app-header__bell'),
    chip: g('.app-header__user'),
    avatar: g('.app-header__avatar'),
    sidebar: g('.sidebar'),
    backdrop: g('.sidebar-backdrop'),
    asideOpen: !!document.querySelector('.sidebar.is-open'),
  };
})()
