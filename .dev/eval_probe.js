JSON.stringify({
  href: location.href,
  ready: document.readyState,
  root: !!document.getElementById('root'),
  rootHTML: document.getElementById('root') ? document.getElementById('root').innerHTML.slice(0, 80) : null,
  scripts: Array.from(document.scripts).map(function (s) { return s.src || 'inline'; }),
  resources: performance.getEntriesByType('resource').map(function (r) { return r.name.split('/').pop() + ':' + r.transferSize; }).slice(0, 8)
});
