import { openExperienceStore, sweepExperience } from '../lib/experience-retention.mjs';

export const config = { schedule: '@hourly' };

export default async function handler(_request, context) {
  const deployContext = context?.deploy?.context;
  if (deployContext !== 'production' || context.deploy.published !== true) {
    console.info('Experience retention skipped: deploy is not published production');
    return new Response(null, { status: 204 });
  }
  const now = Date.now();
  // Batch keys are UUIDs. Sweep one of 16 prefixes per hour to bound each invocation.
  const prefix = (Math.floor(now / 3600000) % 16).toString(16);
  const stats = await sweepExperience(openExperienceStore(deployContext), { dryRun: false, now, prefix });
  console.info(`Experience retention ${JSON.stringify({ prefix, ...stats })}`);
  return new Response(null, { status: 204 });
}
