import { HOME_CSS, HOME_HTML } from './liveHomeMarkup';

/**
 * The public homepage, converted from the approved static mock.
 *
 * The markup is injected verbatim rather than hand-ported to JSX so the approved
 * design stays byte-identical to what was signed off. It carries its own nav and
 * its own scoped styles; every link is a plain <a>, so navigating to /crm or
 * /lists/* is a full page load and none of these styles follow.
 *
 * This is a SERVER component on purpose. The Ninja Path infographic is authored
 * at a fixed 1122px and has to be scaled to its container by script. Doing that
 * in a useEffect makes it depend on hydration; a <script> in the server-rendered
 * HTML runs unconditionally, which is how the original mock behaved. A
 * ResizeObserver keeps it correct through late font/image reflow.
 */
const FIT_SCRIPT = `
(function () {
  var W = 1122;
  function fit() {
    var wrap = document.getElementById('npEmbed');
    if (!wrap) return;
    var frame = wrap.querySelector('iframe');
    if (!frame) return;
    frame.style.transform = 'scale(' + (wrap.clientWidth / W) + ')';
  }
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('load', fit);
  if (typeof ResizeObserver !== 'undefined') {
    var wrap = document.getElementById('npEmbed');
    if (wrap) new ResizeObserver(fit).observe(wrap);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fit);
  }
})();
`;

/**
 * Integration fixes, NOT design changes — which is why they live here rather than
 * in the mock. The mock renders correctly standalone; these exist only because
 * the host app ships Tailwind preflight, which the standalone file never sees:
 *
 *   canvas,embed,iframe,img,object,svg,video { vertical-align:middle; display:block }
 *
 * The mock's markup assumes inline images, so every <img> became a block:
 *   · the ninja at the end of each offer <h2> dropped onto its own line
 *     (vertical-align:middle does nothing to a block box), and
 *   · the meditation ninja in the closing section sat left, because
 *     text-align:center only centres inline content, not a block child.
 *
 * Restoring inline-block on just these images fixes both and lets the existing
 * rules do their work. Scoped to the two homepage selectors — the global
 * preflight rule is left alone, since /crm and the call lists depend on it.
 *
 * Note on sizing: preflight also sets img{height:auto}, but that's an element
 * selector (0,0,1) and .h2-ninja{height:1.75em} is a class (0,1,0), so the
 * explicit height still wins. Verified in the browser, not assumed.
 */
const PREFLIGHT_FIXES = `
.h2-ninja { display: inline-block; }
.close img { display: inline-block; }
`;

export function LiveHome() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: HOME_CSS + PREFLIGHT_FIXES }} />
      <div dangerouslySetInnerHTML={{ __html: HOME_HTML }} />
      <script dangerouslySetInnerHTML={{ __html: FIT_SCRIPT }} />
    </>
  );
}
