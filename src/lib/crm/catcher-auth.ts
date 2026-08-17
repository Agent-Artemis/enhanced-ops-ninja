/**
 * Auth for the two LinkedIn *catcher* routes (add-connection, log-reply).
 *
 * WHY THIS EXISTS
 * LEADS_API_SECRET is an ADMIN-grade credential: besides the LinkedIn routes it
 * also gates crm-admin, run-compliance-migration and crm/run-activities-migration
 * — i.e. anyone holding it can run database migrations and bulk-mutate the CRM.
 *
 * The daily accept-catcher runs as a cloud routine whose prompt is stored in the
 * routine config and echoed into every run transcript, so whatever key it carries
 * is effectively disclosed to anyone who can read those. It has no business
 * holding a migration-capable key: it only ever needs to add a connection and log
 * a reply.
 *
 * So these two routes accept EITHER:
 *   • LINKEDIN_CATCHER_SECRET — narrowly scoped, accepted ONLY here. This is what
 *     the cloud routine carries.
 *   • LEADS_API_SECRET — still accepted, so existing local callers keep working
 *     and so the admin key can be rotated independently without a flag day.
 *
 * Every other secret-protected route continues to require LEADS_API_SECRET alone.
 */
export function authorizeCatcher(req: Request): boolean {
  const provided = req.headers.get("x-leads-secret");
  if (!provided) return false;

  const scoped = process.env.LINKEDIN_CATCHER_SECRET;
  const admin = process.env.LEADS_API_SECRET;

  return Boolean((scoped && provided === scoped) || (admin && provided === admin));
}
