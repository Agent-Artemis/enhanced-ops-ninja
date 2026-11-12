import type { Metadata } from 'next';
import { CONTACT_EMAIL, LEGAL_ENTITY, LegalShell } from '@/components/legal/LegalShell';

/**
 * Public end user licence terms. Intuit requires a EULA at a public URL before
 * it will approve the QuickBooks app for production.
 *
 * Governing law and venue is the one term left blank. It is rendered in a marked
 * box rather than filled in with a plausible state, because the entity address
 * we publish is in Nevada and most clients operate elsewhere, and a guess in
 * that field is the kind of thing that is only ever discovered in a dispute.
 */

export const metadata: Metadata = {
  title: 'Terms of use',
  description:
    'The licence to use the EnhancedOps.Ninja operations dashboard: what you may do with it, what we promise, and what we do not.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of use"
      intro={
        <>
          This is the agreement between you, the customer, and {LEGAL_ENTITY}, trading as
          EnhancedOps.Ninja, for use of the EnhancedOps.Ninja operations dashboard and the
          connectors that feed it. Using the dashboard means you accept these terms.
        </>
      }
    >
      <h2>1. The licence we give you</h2>
      <p>
        We grant you a limited, non exclusive, non transferable, revocable right to access and use
        the dashboard for the internal business operations of your own company, for as long as your
        agreement with us is in force.
      </p>
      <p>You may not:</p>
      <ul>
        <li>resell, rent, sublicense or share your access with anyone outside your company,</li>
        <li>copy the software, or try to recover its source, beyond what the law allows you to do regardless of this clause,</li>
        <li>use it to build a competing product, or to benchmark it for a competitor,</li>
        <li>attack it, probe it, or try to reach data belonging to another customer through it.</li>
      </ul>
      <p>
        We keep every right we have not given you here. The software, the designs and the
        documentation remain ours.
      </p>

      <h2>2. Your account</h2>
      <p>
        Keep your sign in details to yourself and tell us quickly if you think someone else has
        them. What happens under your account is your responsibility until you tell us otherwise.
      </p>

      <h2>3. Your data stays yours</h2>
      <p>
        Your business data is yours. Connecting a system such as QuickBooks Online gives us
        permission to read it so the dashboard can show it to you, and nothing more. We handle it as
        described in our <a href="/privacy">privacy policy</a>, which forms part of these terms.
      </p>
      <p>
        You can withdraw that permission at any time by disconnecting, and we will stop reading and
        delete the access we hold.
      </p>

      <h2>4. Systems you connect</h2>
      <p>
        The dashboard reads from software you already run. Your use of each of those products stays
        governed by your own agreement with that provider, and Intuit terms continue to apply to
        your use of QuickBooks Online. We are not responsible for their availability, their pricing
        or the accuracy of what they hold.
      </p>
      <p>
        You confirm that you have the right to connect the systems you connect, and to let us read
        the data in them.
      </p>

      <h2>5. The dashboard is not advice</h2>
      <p>
        The dashboard reports numbers drawn from the systems you connect. Those numbers can be
        incomplete, out of date, or wrong at the source. The dashboard is an operational aid, not
        accounting, tax, legal, clinical or investment advice, and it is not a system of record. If
        a figure matters, check it where it comes from before you act on it.
      </p>

      <h2>6. Fees</h2>
      <p>
        Fees, the term, and anything agreed specifically for you are set out in the order or service
        agreement you signed with us. Where that document and this page disagree, that document
        wins.
      </p>

      <h2>7. No warranty</h2>
      <p>
        The dashboard is provided as it is and as it is available. To the fullest extent the law
        permits, we make no warranties of any kind, express or implied, including any implied
        warranty of merchantability, fitness for a particular purpose, or non infringement, and we
        do not warrant that the dashboard will be uninterrupted, timely, secure or free of error.
      </p>

      <h2>8. Limit of liability</h2>
      <p>
        To the fullest extent the law permits, neither side is liable to the other for indirect,
        incidental, special or consequential loss, or for lost profits, lost revenue, lost goodwill
        or lost or corrupted data, however caused.
      </p>
      <p>
        Our total liability arising out of or relating to these terms is capped at the greater of the
        fees you paid us in the twelve months before the claim arose, or one hundred United States
        dollars.
      </p>
      <p>
        Nothing here limits a liability that cannot be limited by law. Some jurisdictions do not
        allow some of these exclusions, and in those places they apply only as far as that
        jurisdiction allows.
      </p>

      <h2>9. Your indemnity</h2>
      <p>
        You will cover us against claims and costs that arise from your use of the dashboard in
        breach of these terms or of the law, or from your connecting data you had no right to
        connect.
      </p>

      <h2>10. Ending it</h2>
      <p>
        You may stop using the dashboard at any time, and you may disconnect any connected system at
        any time. Either side may end this agreement in line with the order or service agreement
        between us, and we may suspend access immediately if use of the dashboard is putting the
        service or another customer at risk.
      </p>
      <p>
        When it ends, your access stops, the licence in section 1 ends, and we revoke and delete the
        connection tokens we hold. Ask us for a copy of what we hold for you before you go and we
        will provide it where we reasonably can. Sections 3, 5, 7, 8, 9 and 11 survive.
      </p>

      <h2>11. Changes</h2>
      <p>
        We improve the dashboard continuously, so what it shows and how it looks will change. If we
        change these terms we will change this page and move the effective date at the top, and
        where a change materially reduces your rights we will tell you before it takes effect.
      </p>

      <h2>12. Governing law and venue</h2>
      <div className="field">
        <span className="tag">To be completed by {LEGAL_ENTITY}</span>
        <p>
          Governing law: <span className="blank">pending</span>
          <br />
          Venue for any dispute: <span className="blank">pending</span>
        </p>
        <p>
          Both are deliberately pending rather than filled in with an assumption, and{' '}
          {LEGAL_ENTITY} will set them. Until then, nothing on this page should be read as choosing
          a jurisdiction.
        </p>
      </div>

      <h2>13. The whole agreement</h2>
      <p>
        These terms, the privacy policy, and the order or service agreement you signed are the whole
        agreement between us about the dashboard. If one provision turns out to be unenforceable,
        the rest stay in force. Not enforcing something straight away does not waive it. You may not
        transfer this agreement without our written consent.
      </p>

      <h2>14. Contact</h2>
      <p>
        {LEGAL_ENTITY}, trading as EnhancedOps.Ninja
        <br />
        732 S 6th St, Ste N, Las Vegas, NV 89101, United States
        <br />
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalShell>
  );
}
