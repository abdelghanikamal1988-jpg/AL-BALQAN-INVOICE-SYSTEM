(async () => {
  const q = (s) => document.querySelector(s);
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  const box = (el) => {
    const b = r(el);
    return b ? [Math.round(b.width), Math.round(b.height)] : null;
  };
  const header = q('.app-header');
  const menu = q('.app-header__menu');
  const search = q('.topsearch__input');
  const cta = q('.app-header__cta');
  const tool = q('.app-header__tool');
  const bell = q('.app-header__bell');
  const chip = q('.app-header__user');
  const avatar = q('.app-header__avatar');
  const meta = q('.app-header__user-meta');
  const chev = q('.app-header__ucharv');
  const vr = q('.app-header__vr');
  const card = q('.card');
  const h2 = q('.db-section__head h2');
  const hint = q('.db-section__hint');
  const charts = q('.db-charts');
  const out = {
    header: box(header),
    menu: box(menu),
    search: box(search),
    cta: box(cta),
    tool: box(tool),
    bell: box(bell),
    chip: box(chip),
    avatar: box(avatar),
    avatarFirst: avatar && meta ? +(r(avatar).left < r(meta).left) : null,
    metaLeftOfChev: meta && chev ? +(r(meta).left < r(chev).left) : null,
    vr: vr ? [box(vr), +(getComputedStyle(vr).display !== 'none')] : null,
    controlsEqual: [menu, search, cta, tool, bell, chip]
      .filter(Boolean)
      .map((el) => Math.round(r(el).height)),
    cardRadius: card ? getComputedStyle(card).borderRadius : null,
    cardBorder: card ? getComputedStyle(card).borderColor : null,
    sectionH2: h2
      ? [
          getComputedStyle(h2).fontSize,
          getComputedStyle(h2).textTransform,
          getComputedStyle(h2).fontWeight,
          Math.round(r(h2).height),
        ]
      : null,
    hint: hint ? getComputedStyle(hint).fontSize : null,
    chartsCols: charts ? getComputedStyle(charts).gridTemplateColumns.split(' ').length : null,
    bars: document.querySelectorAll('.db-bars__bar').length,
    linePaths: document.querySelectorAll('.db-line svg path').length,
    invRows: document.querySelectorAll('.db-inv tbody tr').length,
    badges: document.querySelectorAll('.db-badge').length,
    panelHeads: document.querySelectorAll('.db-panel__head h2 .icon').length,
    body: [getComputedStyle(document.body).fontSize, getComputedStyle(document.body).backgroundColor],
    menuHoverable: menu ? getComputedStyle(menu).borderRadius : null,
  };
  return JSON.stringify(out);
})()
