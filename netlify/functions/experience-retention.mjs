import { openExperienceStore, sweepExperience } from '../lib/experience-retention.mjs';

export const config = { schedule: '@hourly' };

export default async function handler() {
  if (process.env.CONTEXT !== 'production') return new Response(null, { status: 204 });
  const now = Date.now();
  // Batch keys are UUIDs. Sweep one of 16 prefixes per hour to bound each invocation.
  const prefix = (Math.floor(now / 3600000) % 16).toString(16);
  const stats = await sweepExperience(openExperienceStore(), { dryRun: false, now, prefix });
  console.info('Experience retention', { prefix, ...stats });
  return new Response(null, { status: 204 });
}
