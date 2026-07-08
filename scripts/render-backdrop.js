const { chromium } = require('playwright');
const fs = require('fs');
const pub = '/Users/agentarty/enhanced-ops-ninja/public/';
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(pub + f).toString('base64');
const logoFile = fs.existsSync(pub + 'logo transparent.png') ? 'logo transparent.png'
  : (fs.existsSync(pub + 'logo-transparent.png') ? 'logo-transparent.png' : 'logo-dark.png');
const LOGO = b64(logoFile);
const NINJA = b64('Ninja_Transparent.png');
const variant = process.argv[2] || 'ninja'; // 'ninja' or 'clean'
const ninjaEl = variant === 'clean' ? '' : `<img class="ninja" src="${NINJA}">`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden}
.stage{position:relative;width:1920px;height:1080px;background:#090D14;overflow:hidden;
  font-family:'Helvetica Neue',Arial,sans-serif}
.glow{position:absolute;left:33%;top:38%;width:1150px;height:1150px;transform:translate(-50%,-50%);
  background:radial-gradient(circle, rgba(26,110,204,0.30), rgba(26,110,204,0) 62%);filter:blur(14px)}
.glow2{position:absolute;right:2%;bottom:-12%;width:1000px;height:1000px;
  background:radial-gradient(circle, rgba(26,110,204,0.14), rgba(26,110,204,0) 60%)}
.grid{position:absolute;inset:0;opacity:0.045;
  background-image:linear-gradient(120deg, transparent 0 49.5%, #7FB2F5 49.7% 50%, transparent 50.2%);
  background-size:64px 64px}
.vig{position:absolute;inset:0;background:radial-gradient(ellipse 80% 75% at 50% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.62) 100%)}
.ninja{position:absolute;right:-30px;top:28px;height:500px;opacity:0.52;
  filter:drop-shadow(0 0 34px rgba(26,110,204,0.45))}
.logo{position:absolute;left:64px;top:54px;display:flex;align-items:center;gap:20px}
.logo img{height:74px;filter:drop-shadow(0 3px 14px rgba(0,0,0,0.55))}
.wm{color:#fff;font-weight:700;letter-spacing:.02em;font-size:30px;text-shadow:0 2px 10px rgba(0,0,0,.5)}
.wm b{color:#3B8FE8}
.tag{position:absolute;left:66px;bottom:60px;color:rgba(255,255,255,0.28);font-size:19px;
  letter-spacing:.28em;text-transform:uppercase;font-weight:600}
</style></head><body>
<div class="stage">
  <div class="glow"></div><div class="glow2"></div><div class="grid"></div>
  ${ninjaEl}
  <div class="vig"></div>
  <div class="logo"><img src="${LOGO}"></div>
  <div class="tag">Rule your day</div>
</div></body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: 'load' });
  await p.screenshot({ path: pub + (variant === 'clean' ? 'zoom-backdrop-clean.png' : 'zoom-backdrop.png') });
  await b.close();
  console.log('rendered', variant);
})();
