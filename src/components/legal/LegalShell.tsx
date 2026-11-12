import Link from 'next/link';
import { HOME_CSS } from '../marketing/liveHomeMarkup';

/**
 * Shell for the two public legal pages, /privacy and /terms.
 *
 * STYLING. The homepage stylesheet is imported rather than copied, so the nav,
 * the footer, the type scale and the colour tokens on these pages are the same
 * rules the live homepage renders with and cannot drift from it. The cost is
 * that a legal page carries some homepage only rules it never uses. That is the
 * cheaper mistake: a second copy of the tokens would look right the day it was
 * written and then quietly stop matching.
 *
 * LEGAL_CSS below adds only what the homepage has no equivalent for: long form
 * prose, and the one deliberately unfilled field in the terms.
 *
 * The homepage rules arrive with their own authoring comments. A comment inside
 * a CSS template literal is a string, so no minifier can reach it and every
 * byte of it is served to every reader. They are stripped here, which changes
 * no rule and no rendering.
 *
 * No dashes in any visible string on these pages. The homepage footer states
 * the company with an em dash between the brand and the entity; the same fact
 * is stated here as a sentence instead, which is the house rule on copy.
 */

const LEGAL_CSS = `
.legal{padding:46px 20px 10px}
.legal h1{font-family:var(--serif);font-weight:900;font-size:clamp(30px,4.6vw,44px);letter-spacing:.02em;line-height:1.08;margin:0 0 10px}
.legal .meta{color:var(--muted);font-size:13px;margin:0 0 30px}
.legal .intro{font-size:17.5px;color:var(--soft);max-width:70ch;margin:0 0 30px}
.legal h2{font-family:var(--sans);font-weight:700;font-size:21px;letter-spacing:0;color:var(--ink);margin:38px 0 12px;padding-top:18px;border-top:1px solid var(--line)}
.legal h3{font-family:var(--sans);font-weight:700;font-size:16px;color:var(--ink);margin:22px 0 8px}
.legal p{font-size:15.5px;color:var(--soft);max-width:74ch;margin:0 0 13px}
.legal li{font-size:15.5px;color:var(--soft);margin:0 0 8px}
.legal ul{max-width:74ch;margin:0 0 15px;padding-left:22px;list-style:disc}
.legal strong{color:var(--ink);font-weight:600}
.legal a{color:var(--blue2)}
.legal .lead-in{color:var(--ink)}
.legal .field{border:1px solid var(--gold);background:rgba(245,179,1,.07);border-radius:11px;padding:18px 20px;margin:0 0 15px;max-width:74ch}
.legal .field .tag{display:inline-block;font-size:11.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:9px}
.legal .field p{color:var(--ink);margin-bottom:10px}
.legal .field p:last-child{margin-bottom:0}
.legal .blank{display:inline-block;min-width:170px;border-bottom:1px solid var(--gold);margin:0 3px;color:var(--gold);font-weight:600}
.legal-foot{padding:34px 0 40px;border-top:1px solid var(--line);margin-top:34px;text-align:center}
.legal-foot .links{display:flex;gap:18px;justify-content:center;flex-wrap:wrap;margin-bottom:12px;font-size:14px;font-weight:700}
.legal-foot .links a{color:var(--blue2);text-decoration:none}
.legal-foot .links a:hover{text-decoration:underline}
.legal-foot .who{color:var(--muted);font-size:12.5px;margin:0}
@media(max-width:700px){.legal{padding-top:30px}.legal h2{margin-top:30px}}
/* The site nav carries a 391px minimum: the logo is capped at 290px and the Book
   a call button measures 67px, so with the 20px gutters and the 14px gap the row
   cannot go under 391 however narrow the screen is. Measured on the live homepage
   in the same frame, which overflows by 71px at 320, by 31px at 360 and by one
   pixel at 390. These two pages get read on a phone, so here the logo is allowed
   to shrink. Scoped to this nav, and it changes nothing on the homepage. */
@media(max-width:430px){.nav img{max-width:min(290px,calc(100vw - 150px))}}
`;

/** No value in HOME_CSS is a quoted string containing a comment opener, so this cannot eat a rule. */
function stripComments (css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

export const EFFECTIVE_DATE = '12 November 2026';

/** Exactly the entity the site already publishes: the homepage footer and the Organization record both name it. */
export const LEGAL_ENTITY = 'Augeo LLC';
export const CONTACT_EMAIL = 'jeff@enhancedops.ninja';

export function LegalShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: stripComments(HOME_CSS) + LEGAL_CSS }} />
      <div className="nav">
        <div className="wrap">
          {/* A PLAIN ANCHOR, NOT next/link, and the same for the Home link in the
              footer. The homepage injects its markup and its sizing script as
              server rendered HTML; a script delivered that way does not run on a
              client side transition, so arriving at the homepage through <Link>
              leaves the Ninja Path panel unscaled. A full page load is also what
              keeps this stylesheet from following the reader off these pages. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">
            {/* Plain img, matching the homepage nav rule, so the two navs cannot differ. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ninja-logo.png" alt="EnhancedOps.Ninja" />
          </a>
          <a className="cta" href="/book" style={{ marginLeft: 'auto' }}>
            Book a call
          </a>
        </div>
      </div>

      <main className="wrap legal">
        <h1>{title}</h1>
        <p className="meta">Effective {EFFECTIVE_DATE}</p>
        <p className="intro">{intro}</p>
        {children}
      </main>

      <div className="wrap">
        <div className="legal-foot">
          <div className="links">
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/terms">Terms of use</Link>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">Home</a>
          </div>
          <p className="who">
            EnhancedOps.Ninja is a dba of {LEGAL_ENTITY}. Questions about this page go to {CONTACT_EMAIL}.
          </p>
        </div>
      </div>
    </>
  );
}
