/**
 * Companion to ocs-proof.mjs. Same warnings apply in full: IT WRITES TO THE
 * LIVE CRM, and it auto-accepts every confirm dialog.
 *
 * This exists because two of the five clicks in ocs-proof.mjs returned "row
 * not found". The cause was not a missing row: the search box filters within
 * the ACTIVE TAB only, and Fountain Life sits under Longevity while Warren
 * Henson sits under Mountain West. This version calls setTab() first, so it
 * takes a tab key as well as a row match.
 *
 * Usage:  cd ~/enhanced-ops-ninja && node tools/ocs-proof-tabbed.mjs
 */
import {chromium} from 'playwright';
const b=await chromium.launch();
const out=[];
async function run(url,tabKey,rowMatch,label){
  const p=await b.newPage({viewport:{width:1300,height:1000}});
  p.on('dialog',d=>d.accept());
  await p.goto(url,{waitUntil:'networkidle'});
  await p.evaluate(()=>document.fonts.ready);
  const r=await p.evaluate(async ({t,m})=>{
    if(t&&typeof setTab==='function'){setTab(t);await new Promise(r=>setTimeout(r,400));}
    const rows=[...document.querySelectorAll('.row')].filter(x=>x.innerText.includes(m));
    if(!rows.length)return{error:'row not found in tab'};
    const btn=rows[0].querySelector('button[id^="ocs"]');
    const before=btn.textContent.trim();
    btn.click(); await new Promise(r=>setTimeout(r,4500));
    return {before,after:btn.textContent.trim(),people:rows[0].querySelectorAll('.pp').length};
  },{t:tabKey,m:rowMatch});
  out.push({label,row:rowMatch,...r}); await p.close();
}
await run('https://enhancedops.ninja/lists/nad-targets.html','long','Fountain Life','4 NAD multi-person bench');
await run('https://enhancedops.ninja/lists/ma-partners.html','mw','Warren Henson','5 ma-partners named row');
console.log(JSON.stringify(out,null,1));
await b.close();
