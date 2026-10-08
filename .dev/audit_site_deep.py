import json
import sys
import time
import urllib.request

import websocket

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

TARGET = ("http://localhost:5173/#/website")

JS = r"""
(() => {
  const vw = window.innerWidth;
  const out = {vw, docScrollW: document.documentElement.scrollWidth,
               docClientW: document.documentElement.clientWidth};

  // 1. containers with inner horizontal scroll (not marquee)
  const innerScroll = [];
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    if (s.display === 'none') continue;
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 40) {
      if (!/partners|marquee|scroll/i.test(el.className)) {
        innerScroll.push({t: el.tagName + '.' + (typeof el.className === 'string' ? el.className.slice(0, 40) : ''),
                          cw: el.clientWidth, sw: el.scrollWidth});
      }
    }
  }
  out.innerScroll = innerScroll.slice(0, 20);

  // 2. major sections geometry
  const secs = [...document.querySelectorAll('.ws-website > *')];
  out.sections = secs.map(el => {
    const r = el.getBoundingClientRect();
    return {c: (typeof el.className === 'string' ? el.className.split(' ')[0] : ''),
            y: Math.round(r.top + window.scrollY), h: Math.round(r.height)};
  });

  // 3. elements overflowing right edge by >1px, grouped (exclude marquee subtree)
  const bad = {};
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.ws-partners__scroll')) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) continue;
    if (r.right > vw + 1) {
      const key = el.tagName + '.' + (typeof el.className === 'string' ? el.className.split(' ')[0] : '');
      bad[key] = (bad[key] || 0) + 1;
    }
  }
  out.overflowRight = bad;

  // 4. overlaps between sibling text blocks (rough)
  const overlaps = [];
  const cards = [...document.querySelectorAll('.ws-service-card, .ws-country-card, .ws-step, .ws-faq-item, .ws-form-group, .ws-consultation__feature')];
  for (let i = 0; i < cards.length; i++) {
    const a = cards[i].getBoundingClientRect();
    for (let j = i + 1; j < cards.length; j++) {
      const b = cards[j].getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 4 && oy > 4 && cards[i].parentNode === cards[j].parentNode) {
        overlaps.push({a: cards[i].className.split(' ')[0], b: cards[j].className.split(' ')[0], ox: Math.round(ox), oy: Math.round(oy)});
      }
    }
  }
  out.cardOverlaps = overlaps.slice(0, 10);

  // 5. images with zero/small size or wrong aspect
  const imgs = [];
  for (const img of document.querySelectorAll('img')) {
    const r = img.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) {
      imgs.push({src: (img.currentSrc || img.src || '').split('/').pop().slice(0, 40),
                 w: Math.round(r.width), h: Math.round(r.height),
                 nw: img.naturalWidth, complete: img.complete});
    }
  }
  out.brokenImgs = imgs.slice(0, 15);

  // 6. hero geometry
  const hero = document.querySelector('.ws-hero');
  if (hero) {
    const r = hero.getBoundingClientRect();
    const t = document.querySelector('.ws-hero__title');
    const d = document.querySelector('.ws-hero__desc');
    const b = document.querySelector('.ws-hero__bottom-fade') || document.querySelector('.ws-hero__actions');
    out.hero = {h: Math.round(r.height),
                titleFs: t ? getComputedStyle(t).fontSize : null,
                titleW: t ? Math.round(t.getBoundingClientRect().width) : null,
                titleH: t ? Math.round(t.getBoundingClientRect().height) : null,
                descFs: d ? getComputedStyle(d).fontSize : null,
                descH: d ? Math.round(d.getBoundingClientRect().height) : null,
                actionsY: b ? Math.round(b.getBoundingClientRect().top + window.scrollY) : null};
  }

  // 7. navbar geometry
  const nav = document.querySelector('.ws-navbar');
  if (nav) {
    const r = nav.getBoundingClientRect();
    const tog = document.querySelector('.ws-navbar__toggle');
    const tr = tog ? tog.getBoundingClientRect() : null;
    const links = document.querySelector('.ws-navbar__links');
    out.navbar = {h: Math.round(r.height), fixed: getComputedStyle(nav).position,
                  toggle: tr ? {w: Math.round(tr.width), h: Math.round(tr.height)} : null,
                  linksDisplay: links ? getComputedStyle(links).display : null,
                  linksPos: links ? getComputedStyle(links).position : null};
  }

  // 8. font sizes of section titles
  out.sectionTitleFs = [...document.querySelectorAll('.ws-section-title')].slice(0, 6)
    .map(e => getComputedStyle(e).fontSize);

  // 9. any element taller than 1.4x viewport that seems short-cropped
  out.longText = [...document.querySelectorAll('p, h1, h2, h3, li, span, a')].filter(e => {
    const s = getComputedStyle(e);
    if (s.display === 'none') return false;
    return e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 60 && s.overflow !== 'auto' && s.overflowX !== 'auto' && s.overflowX !== 'scroll';
  }).slice(0, 12).map(e => ({t: e.tagName + '.' + (typeof e.className === 'string' ? e.className.split(' ')[0] : ''),
                             cw: e.clientWidth, sw: e.scrollWidth, txt: (e.textContent || '').trim().slice(0, 30)}));
  return JSON.stringify(out);
})()
"""

tabs = json.load(urllib.request.urlopen('http://127.0.0.1:9333/json/list', timeout=5))
ws = websocket.create_connection(tabs[0]['webSocketDebuggerUrl'], timeout=30)
mid = 0


def send(method, params=None):
    global mid
    mid += 1
    ws.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get('id') == mid:
            return msg


send('Page.enable')
for w in (360, 390):
    send('Emulation.setDeviceMetricsOverride',
         {'width': w, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
    send('Page.navigate', {'url': TARGET})
    time.sleep(4.5)
    res = send('Runtime.evaluate', {'expression': JS, 'returnByValue': True})
    val = res.get('result', {}).get('result', {}).get('value')
    print(f'########## width {w} ##########')
    print(json.dumps(json.loads(val), indent=1))
ws.close()
