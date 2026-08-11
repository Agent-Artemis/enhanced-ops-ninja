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

export function LiveHome() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: HOME_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: HOME_HTML }} />
      <script dangerouslySetInnerHTML={{ __html: FIT_SCRIPT }} />
    </>
  );
}
