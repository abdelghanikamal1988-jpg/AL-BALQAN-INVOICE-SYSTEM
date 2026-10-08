(async () => {
  const cs = (sel, props) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const s = getComputedStyle(el);
    const o = {};
    props.forEach((p) => (o[p] = s[p]));
    return o;
  };
  const out = {
    th: cs('.db-inv th', ['fontSize', 'fontWeight', 'textTransform', 'letterSpacing', 'color', 'backgroundColor', 'paddingTop', 'borderBottomColor']),
    td: cs('.db-inv td', ['fontSize', 'paddingTop', 'paddingLeft', 'borderBottomColor']),
    thAmount: cs('.db-inv th.db-inv__amount', ['textAlign']),
    tdAmount: cs('.db-inv td.db-inv__amount', ['textAlign', 'fontVariantNumeric', 'fontWeight']),
    badge: cs('.db-badge--paid', ['fontSize', 'fontWeight', 'borderRadius', 'color', 'backgroundColor']),
    chartHead: cs('.db-chart-card__head', ['paddingTop', 'paddingLeft']),
    chartTitle: cs('.db-chart-card__head h2', ['fontSize', 'fontWeight']),
    chartSub: cs('.db-chart-card__sub', ['fontSize', 'color']),
    chartBody: cs('.db-chart-card__body', ['paddingTop']),
    chartH: cs('.db-bars', ['height']),
    fig: cs('.db-fig', ['fontSize', 'color']),
    figB: cs('.db-fig b', ['fontWeight', 'color']),
    dot: cs('.db-fig__dot', ['width', 'height', 'borderRadius', 'backgroundColor']),
    foot: cs('.db-chart-card__foot', ['borderTopColor', 'paddingTop']),
    panelHead: cs('.db-panel__head h2', ['fontSize', 'fontWeight']),
    actTh: cs('.db-act th', ['fontSize', 'backgroundColor', 'textTransform']),
    statValue: cs('.statc__value', ['fontSize', 'fontWeight']),
    statTile: cs('.statc__tile', ['width', 'height', 'borderRadius']),
    sectionIcon: cs('.db-section__head h2 .icon', ['fontSize', 'color']),
  };
  return JSON.stringify(out);
})()
