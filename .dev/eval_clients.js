(() => {
  const row = document.querySelector('.statc-row');
  const labels = document.querySelector('.cl-toolbar .field label');
  const fab = document.querySelector('.fab');
  const wrap = document.querySelector('.cl-table-wrap');
  const tbl = document.querySelector('.cl-table');
  return JSON.stringify({
    statcCols: row && getComputedStyle(row).gridTemplateColumns,
    statcCount: row && row.querySelectorAll('.statc').length,
    labelW: labels && Math.round(labels.getBoundingClientRect().width),
    fabPos: fab && getComputedStyle(fab).position,
    tableScrollable: wrap && (wrap.scrollWidth > wrap.clientWidth),
    tableMinW: tbl && getComputedStyle(tbl).minWidth,
    iconBtns: document.querySelectorAll('.cl-actions .icon-btn').length
  });
})()
