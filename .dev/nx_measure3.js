(async()=>{
await new Promise(r=>setTimeout(r,2000));
const card=document.querySelector('.card');
const out=[];
const walk=(rules,cond)=>{
 for (const r of rules){
  if (r.cssRules){ walk(r.cssRules, cond+' '+ (r.conditionText||'')); continue; }
  if (!r.selectorText) continue;
  try{ if(card.matches(r.selectorText) && /border-radius/.test(r.cssText)) out.push((cond?'@'+cond+' ':'')+r.cssText.slice(0,260)); }catch(e){}
 }
};
for (const ss of document.styleSheets){ let rules; try{rules=ss.cssRules}catch(e){continue} walk(rules,''); }
return JSON.stringify(out,null,1);})()