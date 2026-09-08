/**
 * OCS regression proof for the public call-list pages.
 *
 * Drives the real OCS button on enhancedops.ninja/lists/* with a browser and
 * reports what each click did. Written 3 Sep 2026 to prove that extending
 * /api/crm/call-list-card for company-level cards did not change the behaviour
 * of the three existing lists.
 *
 * ⚠️ IT WRITES TO JEFF'S LIVE CRM. /api/crm/call-list-card INSERTs a real
 *    crm_contacts row when no matching card exists. Running this against a row
 *    that has not been carded creates a production contact. Point it at a test
 *    row, and delete what it creates.
 *
 * ⚠️ IT AUTO-ACCEPTS EVERY CONFIRM. p.on('dialog', d => d.accept()) clicks
 *    through any "are you sure" guard silently, including the removal
 *    confirmation. Whoever re-runs this gets no chance to stop it.
 *
 * WHY IT CLEARS localStorage 'ocs:' KEYS (the `twice` path):
 *    The OCS button toggles on that local flag, so a second click on an
 *    already-carded row sends action:'remove' rather than another create.
 *    Clearing the flag makes the button send CREATE again, which is the only
 *    way to exercise the case that actually matters: Jeff opening the list on
 *    a second device where the flag was never set. That tests whether dedupe
 *    is enforced SERVER-SIDE or only masked by a disabled button.
 *
 *    HONEST CORRECTION FROM THE ONE RUN THIS HAS HAD: the twice path did not
 *    deliver that proof. The second click was still in flight when the 4.5s
 *    wait expired, so it reported "…" and nothing conclusive, and the script
 *    never reads the response body. The dedupe and update behaviour was
 *    actually proven with a direct curl POST, which returned updated:true and
 *    then deduped:true against the same id. Treat the twice path as the right
 *    idea and an unfinished mechanism: it needs to wait on the fetch and read
 *    the JSON, not sleep and read a button label.
 *
 * Usage:  cd ~/enhanced-ops-ninja && node tools/ocs-proof.mjs
 */
import {chromium} from 'playwright';
const b=await chromium.launch();
const results=[];
async function run(url,rowMatch,label,twice){
  const p=await b.newPage({viewport:{width:1300,height:1000}});
  p.on('dialog',d=>d.accept());
  await p.goto(url,{waitUntil:'networkidle'});
  await p.evaluate(()=>document.fonts.ready);
  const r=await p.evaluate(async ({m,twice})=>{
    const q=document.getElementById('q'); if(q){q.value=m; q.dispatchEvent(new Event('input',{bubbles:true}));}
    await new Promise(r=>setTimeout(r,700));
    const rows=[...document.querySelectorAll('.row, tbody tr')].filter(x=>x.innerText.includes(m));
    if(!rows.length)return{error:'row not found'};
    const btn=rows[0].querySelector('button[id^="ocs"]');
    if(!btn)return{error:'no OCS button'};
    const before=btn.textContent.trim();
    btn.click(); await new Promise(r=>setTimeout(r,4000));
    let second=null;
    if(twice){ // simulate a fresh browser: clear the local flag so it POSTs create again
      Object.keys(localStorage).filter(k=>k.startsWith('ocs:')).forEach(k=>localStorage.removeItem(k));
      const b2=[...document.querySelectorAll('.row')].filter(x=>x.innerText.includes(m))[0].querySelector('button[id^="ocs"]');
      b2.click(); await new Promise(r=>setTimeout(r,4000)); second=b2.textContent.trim();
    }
    const after=[...document.querySelectorAll('.row, tbody tr')].filter(x=>x.innerText.includes(m))[0]
      .querySelector('button[id^="ocs"]').textContent.trim();
    return {before,after,second};
  },{m:rowMatch,twice:!!twice});
  results.push({label,page:url.split('/').pop(),row:rowMatch,...r});
  await p.close();
}
await run('https://enhancedops.ninja/lists/ut-operator-execs.html','Ensign','1 REGRESSION operator-execs');
await run('https://enhancedops.ninja/lists/state-associations.html','Alabama','2 REGRESSION state-associations');
await run('https://enhancedops.ninja/lists/nad-targets.html','Gameday','3 NAD no name no phone',true);
await run('https://enhancedops.ninja/lists/nad-targets.html','Fountain Life','4 NAD multi-person bench');
await run('https://enhancedops.ninja/lists/ma-partners.html','Peakview','5 ma-partners named row');
console.log(JSON.stringify(results,null,1));
await b.close();
