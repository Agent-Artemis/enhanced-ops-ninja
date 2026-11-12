import type { Metadata } from 'next';
import { CONTACT_EMAIL, LEGAL_ENTITY, LegalShell } from '@/components/legal/LegalShell';

/**
 * Public privacy policy. Intuit will not approve the QuickBooks app for
 * production without this page at a public URL.
 *
 * Every claim about the QuickBooks connection below was read out of the code
 * that makes the connection, in ephas-ops-wireframe: lib/intuit.ts for the
 * scope and the token exchange, lib/pl.ts for the only call we make,
 * lib/tokenStore.ts for where the tokens live, and
 * app/api/intuit/disconnect/route.ts for what disconnecting does.
 *
 * STORAGE CHANGED ON 12 NOV 2026 and this page changed with it. Dennis's login
 * build, f257a05, replaced the server file with lib/tokenCookie.ts: the bundle
 * is sealed with AES-256-GCM and carried in a cookie marked HttpOnly, Secure and
 * SameSite=Lax, scoped to /api/intuit, capped at thirty days or whatever is left
 * of Intuit's refresh token. The key is INTUIT_TOKEN_KEY, which lives in the
 * hosting configuration. lib/connection.ts clears the connection when a refresh
 * is refused, and the disconnect route drops the cookie in its own response. So
 * the sentence this page used to carry, that the tokens never sit in a browser,
 * is now the false one, and saying only "encrypted" would hide where they rest.
 *
 * One sentence the draft asked for is still deliberately NOT here. "Read only
 * scope": the scope string Intuit offers for accounting is not a read only
 * grant; what is read only is every call we make. The page says that, which is
 * the part we control and can be held to.
 *
 * The cookie store is the sandbox answer. If production puts the connection
 * somewhere else, this section is the part that has to change with it.
 */

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'What EnhancedOps.Ninja collects, what it does with it, and what it never does with it, including the QuickBooks Online connection.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy policy"
      intro={
        <>
          EnhancedOps.Ninja is operated by {LEGAL_ENTITY}. This page covers this website and the
          EnhancedOps.Ninja operations dashboard, including the dashboard connection to QuickBooks
          Online.
        </>
      }
    >
      <h2>The short version</h2>
      <ul>
        <li>We read only the accounting data you ask us to read, and we use it for one thing: showing you your own dashboard.</li>
        <li>We never sell your data, and we never hand it to anyone else for their own purposes.</li>
        <li>You can disconnect QuickBooks whenever you like. When you do, we delete the access we hold.</li>
        <li>If something here is unclear, write to {CONTACT_EMAIL} and a person will answer.</li>
      </ul>

      <h2>Connecting QuickBooks Online</h2>
      <p>
        You connect your own QuickBooks company yourself, through the Intuit sign in. We never ask
        for your QuickBooks user name or password, and we never see it. Intuit asks you to approve
        the connection, and the connection exists only because you approved it.
      </p>

      <h3>One permission, and we only read</h3>
      <p>
        We ask Intuit for a single scope, the accounting scope, and every request we send to
        QuickBooks is a read. We do not create, change or delete anything in your books. We do not
        ask for the payments scope, so we cannot see or move money.
      </p>

      <h3>What we read</h3>
      <p>
        The dashboard reads your Profit and Loss report for the date range shown on the screen.
        Today that is the only report it asks QuickBooks for. If we add another read, this page will
        say so.
      </p>

      <h3>What we do with it</h3>
      <p>
        The figures are used to draw your own operations dashboard, for you. We do not sell them. We
        do not pass them to a third party for that party to use. We do not pool them with the numbers of
        another client, and we do not use them to train models.
      </p>
      <p>
        We do not keep a copy of your accounting figures. The report is fetched from QuickBooks when
        a screen is drawn and is not written into a store of our own.
      </p>

      <h2>The keys to your connection</h2>
      <p>
        When you approve the connection, Intuit issues us tokens that stand in for your permission.
        Before they are stored anywhere we encrypt them with AES-256, in a mode that seals them as
        well as hides them, so a bundle that has been altered fails to open rather than being
        trusted.
      </p>
      <p>The encrypted bundle:</p>
      <ul>
        <li>
          is kept in a cookie in the browser of the person who made the connection, marked secure
          and http only, so page scripts cannot read it and it never crosses a plain connection,
        </li>
        <li>
          is scoped to our QuickBooks routes, so it is sent to us and to nobody else, and only our
          server can open it. The key sits in our hosting configuration, never in our source code
          and never in a log.
        </li>
        <li>
          expires with the permission it carries, and in thirty days at the outside. If Intuit
          refuses to renew the connection we clear it and ask you to connect again, rather than
          holding on to something dead.
        </li>
        <li>
          is never shown in the dashboard and never written into our logs. Where a screen has to
          confirm that a connection is live, it reports the length of a token rather than the token.
        </li>
      </ul>

      <h2>Disconnecting</h2>
      <p>
        You can disconnect at any time, either in the dashboard or from the apps area inside
        QuickBooks itself. When you disconnect in the dashboard we ask Intuit to revoke the tokens,
        and the stored connection is dropped in the same response.
      </p>
      <p>
        It is dropped even when Intuit does not confirm the revoke, because a promise to delete what
        we hold should not depend on another company being available. When that happens the
        dashboard says so plainly, so that you can also remove the connection from inside
        QuickBooks.
      </p>

      <h2>This website</h2>
      <p>
        If you fill in a form here, we receive what you type: your name, your email address, your
        company, and the answers you give. We use it to reply to you and to prepare the work you
        asked about. Booking a call sends you to our scheduling provider, Cal.com, which collects
        what you enter there under its own privacy policy.
      </p>
      <p>
        This site sets no advertising or analytics cookies. Two things on it are fetched from other
        companies as you browse: an icon stylesheet from a public content delivery network, and the
        live demo embedded on the home page. Your browser requests those directly, so those
        providers see your network address, as they do for any site that loads them.
      </p>

      <h2>How long we keep things</h2>
      <p>
        What you send us we keep for as long as we are working together, and afterwards for as long
        as we need it to answer questions about that work. Connection tokens are deleted when you
        disconnect. Ask us to delete what we hold about you and we will, other than records we are
        required to keep.
      </p>

      <h2>Security</h2>
      <p>
        Traffic to us is encrypted in transit. Credentials and tokens are held outside our code
        repository and are reachable only by the server that needs them. Access to a client system
        is limited to the people doing that client work. No system is perfect, and we would rather
        tell you what we do than make a promise we cannot keep.
      </p>

      <h2>Changes to this page</h2>
      <p>
        If what we collect changes, or what we do with it changes, we will change this page and move
        the effective date at the top. A material change to the QuickBooks connection will be
        described here before it takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        {LEGAL_ENTITY}, DBA EnhancedOps.Ninja
        <br />
        732 S 6th St, Ste N, Las Vegas, NV 89101, United States
        <br />
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalShell>
  );
}
