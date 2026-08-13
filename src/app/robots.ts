import type { MetadataRoute } from 'next';

const SITE = 'https://enhancedops.ninja';

// Routes that must never be indexed: the internal CRM, admin, API, and the
// mid-funnel pages that only make sense with a session in hand.
const PRIVATE = [
  '/api/',
  '/crm',
  '/admin',
  '/deep-dive/assessment',
  '/deep-dive/score',
  '/deep-dive/confirmation',
  '/in-depth-ops/',
];

// AI assistants are gated behind their OWN user-agents, separate from the
// classic search crawlers — and several default to "no" unless named. If we
// stay silent here we are invisible to the assistants buyers now ask first.
//
// Two distinct jobs in this list:
//   • retrieval/citation — the bot fetches a page to answer a live question and
//     cites it (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-User).
//   • training/grounding — the bot may use the page to inform the model itself
//     (GPTBot, ClaudeBot, CCBot, Google-Extended, Applebot-Extended).
//
// Google-Extended and Applebot-Extended do NOT affect normal search ranking;
// they only govern AI use. Allowing them opts our content into being quoted.
const AI_AGENTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  'ClaudeBot',
  'Claude-User',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bingbot',
  'DuckDuckBot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      ...AI_AGENTS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: PRIVATE,
      })),
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
