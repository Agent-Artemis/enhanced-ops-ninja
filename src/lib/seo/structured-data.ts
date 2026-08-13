/**
 * schema.org JSON-LD for EnhancedOps.Ninja.
 *
 * Why this exists: AI assistants and search engines resolve a business to an
 * *entity* before they will name it in an answer. Prose alone leaves them
 * guessing what we are, who we serve, and what we sell. This states it in the
 * one vocabulary every engine already parses.
 *
 * HARD RULE — every claim here must be visible on the page it ships with.
 * Schema that describes content a human cannot see is treated as spam and is
 * grounds for a manual action. The three services and the product list below
 * are lifted verbatim from the live homepage; nothing here is invented. If the
 * homepage copy changes, change this with it.
 */

export const SITE_URL = 'https://enhancedops.ninja';

const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;

/** The three offers, worded exactly as they appear on the homepage. */
const SERVICES = [
  {
    name: 'Spoke & Hub Command Center',
    description:
      'A command center that becomes the hub for the systems a multi-location operator already runs — EMR/EHR, payroll, accounting, CRM, scheduling, pharmacy, maintenance and compliance connect as spokes. Existing software stays in place; the command center reads from it and shows every location live on one screen.',
  },
  {
    name: 'Ninja Operating System and Survey Readiness',
    description:
      'The daily operating system that keeps every building audit-ready: location scoreboards, standardized daily stand-up agendas, an SOP bible tying policy and procedure to staff training completion, multi-state SNF survey readiness with predicted citation tags, a checklist creator, and a Plan of Correction creator.',
  },
  {
    name: 'The Ninja Path',
    description:
      'A phased implementation path that takes an operator from scattered and reactive to owning their entire operation.',
  },
];

/** Sample products and services, as listed on the homepage. */
const PRODUCTS = [
  'Agentic Voice AI',
  'Custom EMR',
  'Custom Software Creation',
  'Marketing Automation',
  'Ninja OS — Business & Personal',
  'Insurance Verification',
  'AR Collections',
  'Ops Dashboards & Automation',
];

/**
 * Organization — the entity record. `alternateName` is deliberate: buyers and
 * models see "EnhancedOps", "EON" and the legal "Augeo LLC" in different
 * places (agreements, invoices, email), and without this they can resolve to
 * three unrelated entities instead of one.
 */
export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': ORG_ID,
  name: 'EnhancedOps.Ninja',
  alternateName: ['EnhancedOps', 'EON', 'Enhanced Ops Ninja'],
  legalName: 'Augeo LLC',
  description:
    'EnhancedOps.Ninja pulls the scattered systems of a multi-location operator into one live command center, turning raw data into leverage over time, money, staffing, and patient and client care.',
  url: SITE_URL,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_URL}/logo-ninja.png`,
  },
  image: `${SITE_URL}/logo-ninja.png`,
  email: 'jeff@enhancedops.ninja',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '732 S 6th St, Ste N',
    addressLocality: 'Las Vegas',
    addressRegion: 'NV',
    postalCode: '89101',
    addressCountry: 'US',
  },
  areaServed: { '@type': 'Country', name: 'United States' },
  knowsAbout: [
    'Multi-location operations management',
    'Skilled nursing facility survey readiness',
    'Assisted living compliance',
    'Home health and hospice survey preparation',
    'CMS deficiency and citation tags',
    'Plan of Correction development',
    'Operational data unification',
    'Healthcare operations automation',
  ],
  makesOffer: SERVICES.map((s) => ({
    '@type': 'Offer',
    itemOffered: { '@type': 'Service', name: s.name, description: s.description },
  })),
};

/** WebSite — ties every page to the organization above. */
export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': SITE_ID,
  url: SITE_URL,
  name: 'EnhancedOps.Ninja',
  publisher: { '@id': ORG_ID },
  inLanguage: 'en-US',
};

/**
 * ProfessionalService — the homepage record. Carries the service catalog and
 * the free Visibility Audit, which is the actual entry point we want an
 * assistant to surface when someone asks how to start.
 */
export const homepageServiceSchema = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  '@id': `${SITE_URL}/#service`,
  name: 'EnhancedOps.Ninja',
  url: SITE_URL,
  parentOrganization: { '@id': ORG_ID },
  description:
    'Command center, operating system and survey readiness for multi-location operators — one screen, every location, live.',
  areaServed: { '@type': 'Country', name: 'United States' },
  audience: {
    '@type': 'BusinessAudience',
    name: 'Multi-location operators and owners, including skilled nursing, assisted living, home health and hospice',
  },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Offers',
    itemListElement: [
      ...SERVICES.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.name, description: s.description },
      })),
      ...PRODUCTS.map((p) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: p },
      })),
    ],
  },
  makesOffer: {
    '@type': 'Offer',
    itemOffered: {
      '@type': 'Service',
      name: 'Free Visibility Audit',
      description:
        'A free audit that shows a multi-location operator where the leverage is hiding across time, money, staffing and care.',
    },
    price: 0,
    priceCurrency: 'USD',
  },
};

/**
 * FAQ — mirrors the <details> blocks rendered on the homepage, verbatim in
 * substance. Google and the AI crawlers both treat FAQ markup describing text a
 * visitor cannot see as spam, so this array and the FAQ section in
 * liveHomeMarkup.ts must be changed together. If the section is ever removed
 * from the page, delete faqSchema from the homepage in the same commit.
 */
const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Do I have to replace my EMR or payroll system?",
    a:
      "No. EnhancedOps.Ninja does not replace any system you already run. Your EMR/EHR, payroll, accounting, CRM, scheduling, pharmacy, maintenance and compliance software all stay exactly where they are. The command center sits at the hub of the wheel and your existing tools are the spokes on the outside. Secure connectors read from them, so nothing is ripped out, re-implemented, or re-trained. That is the point of the spoke-and-hub design: the fastest way to get every location on one screen is to consolidate the numbers rather than the software.",
  },
  {
    q: "What is an operations command center for a multi-location operator?",
    a:
      "An operations command center is a single live screen that pulls the numbers out of every system and every location into one view, so an owner can see the whole operation without waiting for month-end. For a multi-location operator the problem is not a lack of data — it is that census sits in the EMR, labor sits in payroll, revenue sits in accounting, and nobody sees them together until someone builds a spreadsheet three weeks later. A command center removes that lag. EnhancedOps.Ninja builds it around the four areas owners actually act on: time, money, staffing, and patient and client care.",
  },
  {
    q: "How do I know if my facility is ready for a state survey?",
    a:
      "You are survey-ready when you know which tags you are most likely to be cited on, you have documented evidence closing each one, and your staff training is current and provable. Most operators find out they were not ready only when the surveyor is already in the building. The Ninja Operating System makes that measurable rather than a gut feel: • Deficiency intelligence — which tags are actually being cited on facilities like yours, drawn from survey data across every state • Readiness score — one number per building that leaders can act on, tracked week over week • Checklist creator — per-tag audit prep you can assign, track and close out • SOP Bible — every policy and procedure tied to who has completed the training",
  },
  {
    q: "What is a Plan of Correction, and what makes one get rejected?",
    a:
      "A Plan of Correction is the written response a facility must submit after a survey citation, stating what went wrong, why, what will be fixed, who owns it, and by when. Plans are most often rejected for one reason: they describe the fix without identifying the root cause, or they fail to say how the facility will monitor that the fix holds. The Ninja Operating System includes a Plan of Correction creator that walks a citation through deficiency, root cause, corrective action, responsible party and completion date — so the submission is complete the first time instead of coming back for rework.",
  },
  {
    q: "How long does it take to get running, and what does it cost to find out?",
    a:
      "Finding out costs nothing — the starting point is a free Visibility Audit. The audit shows where the leverage is hiding across time, money, staffing and care, using your own operation rather than a generic demo. Because nothing is being ripped out and replaced, implementation follows a phased path — the Ninja Path — rather than a single cutover date, so you get value from the first connected system instead of waiting for all of them. Scope and timeline depend on how many locations and how many systems are in play, which is what the audit establishes.",
  },
  {
    q: "Does this work for assisted living, home health and hospice, or only skilled nursing?",
    a:
      "It works across all of them. EnhancedOps.Ninja serves multi-location operators in skilled nursing, assisted living, home health and hospice, and other healthcare-adjacent multi-site businesses. The survey-readiness side is built per regime, because the regimes genuinely differ: skilled nursing is surveyed federally against F-tags, assisted living is licensed state by state under each state's own rules, and home health and hospice carry their own tag sets. The operating system underneath — scoreboards, stand-ups, SOP bible, checklists — is the same discipline in every setting.",
  },
  {
    q: "Who is this actually for?",
    a:
      "Owners and operators running multiple locations who already have the software and still cannot get a straight answer about how the business is doing. It is a poor fit for a single site with one system and a clear view of its numbers. It fits when there are enough locations and enough disconnected systems that answering a basic question — which building is bleeding agency dollars, which one is drifting on survey risk — takes someone a day of spreadsheet work.",
  },
];

export const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': `${SITE_URL}/#faq`,
  isPartOf: { '@id': SITE_ID },
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

/** Serialized for a <script type="application/ld+json"> tag. */
export function jsonLd(schema: object): string {
  // `<` is escaped so a stray sequence in any string cannot close the script tag.
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}
