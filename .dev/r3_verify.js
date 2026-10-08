(async () => {
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const out = {};
  out.barY = qa('.db-bars__yaxis span').map((el) => el.textContent);
  out.lineY = qa('.db-line__yaxis span').map((el) => el.textContent);
  out.gridSpans = [qa('.db-bars__grid span').length, qa('.db-line__grid span').length];
  out.svgPaths = qa('.db-line svg path').length;
  out.smoothHasC = (q('.db-line svg path:nth-of-type(2)') || {}).getAttribute
    ? q('.db-line svg path:nth-of-type(2)').getAttribute('d').includes(' C')
    : null;
  out.secondStroke = q('.db-line svg path:nth-of-type(3)')?.getAttribute('stroke');
  out.tips = qa('.db-tip').length;
  out.lhits = qa('.db-lhit').length;
  out.donut = q('.db-donut') ? [
    getComputedStyle(q('.db-donut')).borderRadius,
    q('.db-donut').getAttribute('style'),
    q('.db-donut__center b')?.textContent,
  ] : null;
  out.hbars = qa('.db-hbar').length;
  out.hbarVals = qa('.db-hbar__val').map((el) => el.textContent);
  out.agentRows = qa('[aria-label="Agent performance"] tbody tr').length;
  out.agentCols = qa('[aria-label="Agent performance"] thead th').length;
  out.agentFoot = q('[aria-label="Agent performance"] tfoot td')?.textContent;
  out.custRows = qa('[aria-label="Top customers"] tbody tr').length;
  out.logRows = qa('[aria-label="Access logs"] tbody tr').length;
  out.logBadge = q('[aria-label="Access logs"] tbody .db-badge')?.className;
  out.chartH = [q('.db-bars')?.getBoundingClientRect().height, q('.db-line')?.getBoundingClientRect().height].map(Math.round);
  out.tableCount = qa('table.db-inv').length;
  // pin a tooltip on the Aug bar (i=3) and the Sep line band (i=4)
  qa('.db-bars__col')[3]?.classList.add('is-active');
  qa('.db-lhit')[4]?.classList.add('is-active');
  return JSON.stringify(out);
})()
