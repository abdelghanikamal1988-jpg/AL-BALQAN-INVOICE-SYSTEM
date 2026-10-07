(() => JSON.stringify({
  href: location.href,
  title: document.title,
  hasLogin: !!document.querySelector('input[type=password]'),
  shell: !!document.querySelector('.app-shell'),
  sidebar: !!document.querySelector('.sidebar'),
  main: document.querySelector('.app-shell__main') ? getComputedStyle(document.querySelector('.app-shell__main')).marginLeft : null,
  cssOK: getComputedStyle(document.body).backgroundColor
}))()
