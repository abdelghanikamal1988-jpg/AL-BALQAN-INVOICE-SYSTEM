(() => {
  const sb = document.querySelector('.sidebar');
  const bd = document.querySelector('.sidebar-backdrop');
  const brand = document.querySelector('.app-header__brand');
  const nav = document.querySelector('.app-header__nav');
  const cs = sb ? getComputedStyle(sb) : null;
  const cta = document.querySelector('.app-header__cta');
  const act = document.querySelector('.sidebar__link.is-active');
  const menu = document.querySelector('.app-header__menu');
  return JSON.stringify({
    sidebarPos: cs && cs.position,
    sidebarW: sb && Math.round(sb.getBoundingClientRect().width),
    sidebarTop: sb && Math.round(sb.getBoundingClientRect().top),
    sidebarOpen: sb && sb.classList.contains('is-open'),
    backdropDisplay: bd && getComputedStyle(bd).display,
    backdropInset: bd && getComputedStyle(bd).inset,
    headerBrand: brand && getComputedStyle(brand).display,
    headerNavExists: !!nav,
    ctaBg: cta && getComputedStyle(cta).backgroundColor,
    activeBg: act && getComputedStyle(act).backgroundColor,
    menuVisible: menu && getComputedStyle(menu).display
  });
})()
