/**
 * Presentation chrome — styles and navigation for the generated deck.
 *
 * Kept as plain strings injected into the server-rendered page rather than a
 * client component: the deck is presented from a laptop or iPad, often on
 * conference wifi, and it must render and navigate without waiting on
 * hydration. Same reasoning as the Ninja Path fit script on the homepage.
 */

export const DECK_CSS = `
:root{
 --bg:#0A0F1A;--panel:#0E1420;--panel2:#131b2b;--ink:#EEF3FA;--soft:#AEBBCD;--muted:#7E8DA0;
 --line:#243044;--line2:#31415c;--blue:#1A6ECC;--blue2:#3F8AE0;--gold:#F5B301;--red:#EF4444;--green:#22C55E;
 --bebas:'Bebas Neue',Impact,sans-serif;--dm:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--dm);overflow:hidden}
.stage{position:fixed;inset:0}
.slide{display:none;width:100%;height:100%;padding:4.5vh 5vw 9vh;overflow-y:auto;
 background:radial-gradient(1100px 520px at 84% -12%,rgba(26,110,204,.13),transparent 62%)}
.slide.on{display:flex;flex-direction:column;justify-content:center}
.eyebrow{font-family:var(--bebas);font-size:clamp(13px,1.5vw,18px);letter-spacing:.2em;color:var(--blue2);margin:0 0 1.4vh}
h1{font-family:var(--bebas);font-size:clamp(38px,7.6vw,104px);line-height:.97;letter-spacing:.01em;margin:0 0 2vh}
h1 .hl{color:var(--blue)}
h2{font-family:var(--bebas);font-size:clamp(30px,5.4vw,68px);line-height:1;letter-spacing:.02em;margin:0 0 2vh}
h2 .hl{color:var(--gold)}
.lede{color:var(--soft);font-size:clamp(15px,2.05vw,26px);max-width:46ch;line-height:1.45;margin:0}
.big{font-family:var(--bebas);font-size:clamp(60px,15vw,190px);line-height:.88;color:var(--blue2)}
.big.gold{color:var(--gold)}
.cap{color:var(--soft);font-size:clamp(14px,1.85vw,23px);max-width:40ch;line-height:1.4}
.logo{width:clamp(150px,17vw,250px);margin-bottom:3.4vh}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1.6vw;margin-top:2.6vh}
.card{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:14px;padding:2.1vh 1.5vw}
.card .n{font-family:var(--bebas);font-size:clamp(34px,5.2vw,68px);line-height:1;color:var(--blue2)}
.card .n.warn{color:var(--gold)}
.card .l{color:var(--soft);font-size:clamp(12px,1.15vw,16px);margin-top:.7vh;line-height:1.35}
.bars{margin-top:2.4vh;max-width:980px}
.brow{display:flex;align-items:center;gap:1.2vw;margin-bottom:1.5vh}
.brow .k{width:clamp(96px,11vw,168px);font-size:clamp(12px,1.35vw,19px);color:var(--soft);flex:none;font-weight:600}
.brow .tr{flex:1;height:clamp(24px,3.4vh,42px);background:#0b1220;border:1px solid var(--line2);border-radius:7px;overflow:hidden}
.brow .fl{height:100%;background:var(--blue);width:0;transition:width .85s cubic-bezier(.2,.7,.3,1)}
.brow .fl.ut{background:var(--gold)}
.brow .v{width:clamp(52px,5vw,78px);text-align:right;font-family:var(--bebas);font-size:clamp(20px,2.9vw,38px);flex:none;font-variant-numeric:tabular-nums}
.brow .v.ut{color:var(--gold)}
table{border-collapse:collapse;width:100%;font-size:clamp(11px,1.28vw,17px);margin-top:1.8vh}
th{background:#0b1220;color:var(--blue2);text-align:left;font-size:clamp(9px,.86vw,12px);letter-spacing:.09em;
 text-transform:uppercase;padding:1.1vh .8vw;border-bottom:1px solid var(--line);font-weight:800;white-space:nowrap}
td{padding:.95vh .8vw;border-bottom:1px solid var(--line)}
td.tag{font-weight:800;white-space:nowrap}
td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.pill{display:inline-block;font-size:clamp(9px,.92vw,13px);font-weight:800;padding:1px 6px;border-radius:5px}
.pill.up{color:var(--gold);background:rgba(245,179,1,.14);border:1px solid rgba(245,179,1,.36)}
.pill.dn{color:var(--green);background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.32)}
.pill.flat{color:var(--muted);background:rgba(126,141,160,.12);border:1px solid rgba(126,141,160,.3)}
tr.hot td{background:rgba(245,179,1,.07)}
.qs{margin-top:2.2vh;max-width:64ch}
.q{background:#0b1220;border:1px solid var(--line2);border-left:3px solid var(--blue);border-radius:10px;
 padding:1.5vh 1.3vw;margin-bottom:1.2vh;font-size:clamp(13px,1.5vw,20px);color:var(--soft);line-height:1.4}
.q b{color:var(--ink)}
ul.pts{margin:2vh 0 0;padding-left:1.3em;max-width:48ch}
ul.pts li{font-size:clamp(14px,1.75vw,23px);color:var(--soft);margin-bottom:1.3vh;line-height:1.4}
ul.pts li b{color:var(--ink)}
.bar{position:fixed;left:0;right:0;bottom:0;height:4px;background:#0b1220;z-index:40}
.bar>i{display:block;height:100%;background:var(--blue);width:0;transition:width .3s}
.hud{position:fixed;bottom:14px;right:18px;z-index:41;display:flex;gap:10px;align-items:center;
 font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.hud button{appearance:none;background:#0b1220;border:1px solid var(--line2);color:var(--soft);
 border-radius:7px;padding:7px 11px;font-size:12px;cursor:pointer;font-family:var(--dm);min-height:34px}
.hud button:hover{border-color:var(--blue);color:var(--blue2)}
.brand{position:fixed;bottom:12px;left:18px;z-index:41;font-size:11.5px;color:var(--muted);letter-spacing:.04em}
.notes{position:fixed;left:0;right:0;bottom:0;max-height:46vh;overflow-y:auto;background:rgba(6,10,18,.985);
 border-top:2px solid var(--blue);padding:18px 22px 26px;z-index:50;display:none;font-size:14.5px;line-height:1.6;color:var(--soft)}
.notes.on{display:block}
.notes h4{margin:0 0 8px;font-family:var(--bebas);font-size:17px;letter-spacing:.13em;color:var(--blue2)}
.notes p{margin:0 0 9px;max-width:96ch}
.notes b{color:var(--ink)}
.notes .say{border-left:3px solid var(--gold);padding-left:12px;color:var(--ink);font-style:italic}
@media(max-width:640px){.slide{padding:3vh 6vw 11vh}}
`;

export const DECK_SCRIPT = `
(function(){
  // WRITTEN TO SURVIVE REACT REGENERATING THE TREE.
  // This script runs during parse, before hydration. If React finds any
  // mismatch it discards the server tree and rebuilds it — detaching every
  // node a script is holding. Previously this file cached the slide list and
  // bound onclick directly to #next/#prev, so after a rebuild the deck showed
  // a correct slide 1 that could not advance: the classes were fine, the
  // LISTENERS were attached to nodes that no longer existed.
  // Two rules keep it alive regardless of ordering:
  //   1. never cache element references — re-query on every use
  //   2. never bind to an element — delegate from document, which React
  //      never replaces
  function slides(){ return [].slice.call(document.querySelectorAll('.slide')); }
  if(!slides().length) return;
  var i=0, notesOn=false;
  function paintNotes(){
    var sl=slides(); if(!sl[i]) return;
    var raw=sl[i].getAttribute('data-notes')||'';
    var html='';
    raw.split('|').forEach(function(p){
      p=p.trim(); if(!p) return;
      html += (p.indexOf('SAY:')===0)
        ? '<p class="say">'+p.slice(4).trim()+'</p>'
        : '<p>'+p+'</p>';
    });
    var nb=document.getElementById('notesBody'); if(nb) nb.innerHTML=html||'<p>&mdash;</p>';
  }
  function show(n){
    var sl=slides(); if(!sl.length) return;
    i=Math.max(0,Math.min(sl.length-1,n));
    sl.forEach(function(s,k){s.classList.toggle('on',k===i);});
    var c=document.getElementById('cnt'); if(c) c.textContent=(i+1)+' / '+sl.length;
    var pr=document.getElementById('prog'); if(pr) pr.style.width=((i+1)/sl.length*100)+'%';
    var fls=sl[i].querySelectorAll('.fl');
    [].forEach.call(fls,function(f){f.style.width='0';});
    setTimeout(function(){[].forEach.call(fls,function(f){f.style.width=(f.getAttribute('data-w')||0)+'%';});},60);
    paintNotes();
    try{history.replaceState(null,'','#'+(i+1));}catch(e){}
  }
  // Delegated from document: survives the tree being rebuilt under us.
  document.addEventListener('click',function(e){
    var t=e.target && e.target.closest ? e.target.closest('#next,#prev') : null;
    if(!t) return;
    e.preventDefault();
    show(t.id==='next' ? i+1 : i-1);
  });
  document.getElementById('btnNotes').onclick=function(){
    notesOn=!notesOn;document.getElementById('notes').classList.toggle('on',notesOn);};
  document.getElementById('btnFull').onclick=function(){
    if(!document.fullscreenElement){document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen();}
    else{document.exitFullscreen&&document.exitFullscreen();}};
  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown'){e.preventDefault();show(i+1);}
    else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();show(i-1);}
    else if(e.key==='Home'){show(0);} else if(e.key==='End'){show(slides().length-1);}
    else if(e.key==='n'||e.key==='N'){document.getElementById('btnNotes').click();}
    else if(e.key==='f'||e.key==='F'){document.getElementById('btnFull').click();}
  });
  // Also delegated, for the same reason as the buttons.
  var x0=null;
  document.addEventListener('touchstart',function(e){
    if(!(e.target&&e.target.closest&&e.target.closest('#stage')))return;
    x0=e.changedTouches[0].clientX;},{passive:true});
  document.addEventListener('touchend',function(e){
    if(!(e.target&&e.target.closest&&e.target.closest('#stage')))return;
    if(x0===null)return; var dx=e.changedTouches[0].clientX-x0;
    if(Math.abs(dx)>55) show(i+(dx<0?1:-1)); x0=null;},{passive:true});
  var start=parseInt((location.hash||'').replace('#',''),10);
  show(isNaN(start)?0:start-1);
})();
`;
