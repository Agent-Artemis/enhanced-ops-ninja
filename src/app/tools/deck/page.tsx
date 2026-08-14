import type { Metadata } from "next";
import { SECTORS, SECTOR_KEYS, listStates, stateName, type Sector } from "@/lib/deck/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Presentation Builder",
  robots: { index: false, follow: false },
};

const CSS = `
:root{--bg:#0A0F1A;--panel:#0E1420;--panel2:#131b2b;--ink:#EEF3FA;--soft:#AEBBCD;--muted:#7E8DA0;
 --line:#243044;--line2:#31415c;--blue:#1A6ECC;--blue2:#3F8AE0;--gold:#F5B301;
 --bebas:'Bebas Neue',Impact,sans-serif;--dm:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(900px 440px at 82% -10%,rgba(26,110,204,.10),transparent 60%),var(--bg);
 color:var(--ink);font-family:var(--dm);line-height:1.5}
.pg{max-width:960px;margin:0 auto;padding:22px 16px 80px}
.logo{width:min(230px,54vw);display:block;margin-bottom:18px}
h1{font-family:var(--bebas);font-size:clamp(30px,6.2vw,46px);line-height:1;margin:0 0 8px}
.lede{color:var(--soft);font-size:15.5px;max-width:64ch;margin:0 0 6px}
h2{font-family:var(--bebas);font-size:22px;letter-spacing:.04em;margin:30px 0 4px;color:var(--blue2)}
.hint{color:var(--muted);font-size:13px;margin:0 0 12px}
.sectors{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:9px}
.sec{display:block;background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);
 border-radius:11px;padding:13px 15px;cursor:pointer;transition:border-color .15s}
.sec:hover{border-color:var(--blue)}
.sec input{display:none}
.sec.on{border-color:var(--blue);background:linear-gradient(180deg,rgba(26,110,204,.16),var(--panel2))}
.sec .t{font-weight:700;font-size:15px}
.sec .s{color:var(--muted);font-size:12px;margin-top:3px}
.states{display:flex;flex-wrap:wrap;gap:7px;margin-top:4px}
.st{appearance:none;border:1px solid var(--line2);background:#0b1220;color:var(--soft);font-family:var(--dm);
 font-size:13px;font-weight:700;padding:9px 13px;border-radius:8px;cursor:pointer;min-height:42px;min-width:52px}
.st:hover{border-color:var(--blue);color:var(--blue2)}
.st.on{background:var(--blue);border-color:var(--blue);color:#fff}
.out{margin-top:26px;background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line2);
 border-radius:13px;padding:20px}
.out h3{font-family:var(--bebas);font-size:24px;letter-spacing:.03em;margin:0 0 4px}
.out .sub{color:var(--soft);font-size:14px;margin:0 0 15px}
.acts{display:flex;gap:10px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;justify-content:center;background:var(--blue);color:#fff;
 text-decoration:none;font-weight:700;font-size:15px;padding:14px 22px;border-radius:9px;min-height:50px;flex:1 1 200px}
.btn.alt{background:#0b1220;border:1px solid var(--line2);color:var(--blue2)}
.btn[aria-disabled="true"]{opacity:.4;pointer-events:none}
.note{background:var(--panel2);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:10px;
 padding:13px 15px;margin-top:22px;font-size:13.5px;color:var(--soft)}
.note b{color:var(--ink)}
.foot{margin-top:26px;color:var(--muted);font-size:11.5px;border-top:1px solid var(--line);padding-top:14px}
`;

export default async function DeckBuilder() {
  // Only offer states that actually HAVE data for that sector — an empty deck
  // in front of an association is worse than not offering the state at all.
  const entries = await Promise.all(
    SECTOR_KEYS.map(async (s) => {
      try { return [s, await listStates(s)] as const; }
      catch { return [s, [] as string[]] as const; }
    }),
  );
  const statesBySector = Object.fromEntries(entries) as Record<Sector, string[]>;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/ninja-logo.png" alt="EnhancedOps.ninja" />
        <h1>Presentation Builder</h1>
        <p className="lede">
          Pick a sector and a state. The deck and the one-pager are generated from live survey
          data — the numbers are current every time you open them, not baked in.
        </p>

        <h2>1 · Sector</h2>
        <p className="hint">Number of states with usable data in brackets.</p>
        <div className="sectors" id="sectors">
          {SECTOR_KEYS.map((s) => (
            <label className="sec" key={s} data-sector={s}>
              <input type="radio" name="sector" value={s} />
              <div className="t">{SECTORS[s].label}</div>
              <div className="s">{statesBySector[s].length} states · {SECTORS[s].tagWord}s</div>
            </label>
          ))}
        </div>

        <h2>2 · State</h2>
        <p className="hint" id="stateHint">Choose a sector first.</p>
        <div className="states" id="states" />

        <div className="out" id="out" style={{ display: "none" }}>
          <h3 id="outTitle" />
          <p className="sub" id="outSub" />
          <div className="acts">
            <a className="btn" id="linkDeck" href="#">Open presentation →</a>
            <a className="btn alt" id="linkOne" href="#">Open one-pager →</a>
            <a className="btn alt" id="copyOne" href="#" role="button">Copy one-pager link</a>
          </div>
        </div>

        <div className="note">
          <b>Present with the speaker notes.</b> In the deck press <b>N</b> for the talk track and <b>F</b> for
          fullscreen; arrow keys or swipe to move. Every slide carries a coaching note and a
          &ldquo;SAY:&rdquo; line you can deliver close to verbatim.<br /><br />
          <b>Assisted living works differently.</b> It is licensed state by state under each state&apos;s own rules,
          so there is no valid national benchmark — those decks compare the state against itself and say so
          on the slide rather than inventing a comparison.
        </div>

        <div className="foot">
          Data: CMS and CLIA federal survey files plus state licensing data · rolling three-year window ·
          ranked by distinct facilities cited · survey preamble rows excluded.
        </div>

        <script dangerouslySetInnerHTML={{ __html: `
(function(){
  var STATES=${JSON.stringify(statesBySector)};
  var NAMES=${JSON.stringify(
    Object.fromEntries(
      Array.from(new Set(Object.values(statesBySector).flat())).map((c) => [c, stateName(c)]),
    ),
  )};
  var LABELS=${JSON.stringify(Object.fromEntries(SECTOR_KEYS.map((s) => [s, SECTORS[s].label])))};
  var sector=null, state=null;

  function renderStates(){
    var box=document.getElementById('states');
    var hint=document.getElementById('stateHint');
    if(!sector){box.innerHTML='';hint.textContent='Choose a sector first.';return;}
    var list=STATES[sector]||[];
    hint.textContent=list.length+' states have data for '+LABELS[sector]+'.';
    box.innerHTML=list.map(function(c){
      return '<button class="st'+(c===state?' on':'')+'" data-st="'+c+'" title="'+(NAMES[c]||c)+'">'+c+'</button>';
    }).join('');
  }
  function renderOut(){
    var out=document.getElementById('out');
    if(!sector||!state){out.style.display='none';return;}
    out.style.display='block';
    document.getElementById('outTitle').textContent=(NAMES[state]||state)+' · '+LABELS[sector];
    document.getElementById('outSub').textContent='Generated live from current survey data.';
    var d='/deck/'+sector+'/'+state.toLowerCase();
    var o='/onepager/'+sector+'/'+state.toLowerCase();
    document.getElementById('linkDeck').href=d;
    document.getElementById('linkOne').href=o;
    document.getElementById('copyOne').setAttribute('data-url',location.origin+o);
  }
  document.getElementById('sectors').addEventListener('click',function(e){
    var l=e.target.closest('.sec'); if(!l) return;
    sector=l.getAttribute('data-sector'); state=null;
    [].forEach.call(document.querySelectorAll('.sec'),function(x){x.classList.toggle('on',x===l);});
    renderStates(); renderOut();
  });
  document.getElementById('states').addEventListener('click',function(e){
    var b=e.target.closest('.st'); if(!b) return;
    state=b.getAttribute('data-st');
    [].forEach.call(document.querySelectorAll('.st'),function(x){x.classList.toggle('on',x===b);});
    renderOut();
  });
  document.getElementById('copyOne').addEventListener('click',function(e){
    e.preventDefault();
    var u=this.getAttribute('data-url'); if(!u) return;
    var self=this;
    navigator.clipboard.writeText(u).then(function(){
      var t=self.textContent; self.textContent='Copied ✓';
      setTimeout(function(){self.textContent=t;},1400);
    }).catch(function(){ window.prompt('Copy this link:',u); });
  });
})();
        ` }} />
      </div>
    </>
  );
}
