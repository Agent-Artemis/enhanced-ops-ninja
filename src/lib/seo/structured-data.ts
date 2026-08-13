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

/** Serialized for a <script type="application/ld+json"> tag. */
export function jsonLd(schema: object): string {
  // `<` is escaped so a stray sequence in any string cannot close the script tag.
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}
