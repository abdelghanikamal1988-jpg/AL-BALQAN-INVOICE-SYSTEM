(async()=>{
document.documentElement.setAttribute('data-bs-theme','light');
document.documentElement.style.colorScheme='light';
await new Promise(r=>setTimeout(r,800));
const card=document.querySelector('.card');
const hdr=document.querySelector('header.navbar');
const inp=document.querySelector('.nx-search .form-control');
const chip=document.querySelector('.nx-user-chip');
const cs=getComputedStyle(card);
return JSON.stringify({
 cardRad: cs.borderRadius, cardBorder: cs.border, cardShadow: cs.boxShadow, cardBg: cs.backgroundColor,
 hdrBg: getComputedStyle(hdr).backgroundColor, hdrH: hdr.getBoundingClientRect().height,
 inputBg: getComputedStyle(inp).backgroundColor, inputRad: getComputedStyle(inp).borderRadius, inputH: inp.getBoundingClientRect().height,
 bodyBg: getComputedStyle(document.body).backgroundColor,
 chipKids: [...chip.children].map(k=>{const r=k.getBoundingClientRect();return {t:k.className.split(' ')[0], w:+r.width.toFixed(1), h:+r.height.toFixed(1), x:+r.x.toFixed(1)}}),
 radiusLg: getComputedStyle(document.documentElement).getPropertyValue('--tblr-border-radius-lg')
},null,1);})()