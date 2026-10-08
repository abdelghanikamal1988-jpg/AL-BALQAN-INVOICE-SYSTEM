(async()=>{
await new Promise(r=>setTimeout(r,2000));
const card=document.querySelector('.card');
const cs=getComputedStyle(card);
const el=document.documentElement.style;
return JSON.stringify({
 cardRad: cs.borderRadius,
 cardVar: cs.getPropertyValue('--tblr-card-border-radius'),
 lgVar: cs.getPropertyValue('--tblr-border-radius-lg'),
 shadow: cs.boxShadow,
 border: cs.border,
 headerBg: getComputedStyle(document.querySelector('header.navbar')).backgroundColor,
 headerH: document.querySelector('header.navbar').getBoundingClientRect().height,
 bodyBg: getComputedStyle(document.body).backgroundColor,
 theadTh: (()=>{const t=document.querySelector('.table th, thead th'); return t? {fs:getComputedStyle(t).fontSize, fw:getComputedStyle(t).fontWeight, color:getComputedStyle(t).color, tt:getComputedStyle(t).textTransform}:null})(),
 tableRowH: (()=>{const t=document.querySelector('.table tbody tr'); return t? +t.getBoundingClientRect().height.toFixed(1):null})()
},null,1);})()