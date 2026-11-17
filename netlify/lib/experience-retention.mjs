import { getStore } from '@netlify/blobs';

const retentionMs = 90 * 86400000;
export const isJourney = event => event === 'journey_step' || event.startsWith('toeic_');
export const isExpired = (entry, now) =>
  (isJourney(entry.event) || entry.event === 'ux_signal') && entry.at < now - retentionMs;

export const openExperienceStore = () => getStore({
  name: process.env.CONTEXT === 'production' ? 'dd-experience' : 'dd-experience-preview',
  consistency: 'strong',
});

export async function sweepExperience(store, { dryRun, now = Date.now(), prefix } = {}) {
  const stats = { dryRun, cutoff: now - retentionMs, batchesScanned: 0, batchesAffected: 0,
    expiredEntries: 0, entriesRemoved: 0, batchesCleared: 0, batchesRewritten: 0, conflicts: 0 };
  for await (const { blobs } of store.list({ paginate: true, prefix })) {
    for (let offset = 0; offset < blobs.length; offset += 20) {
      await Promise.all(blobs.slice(offset, offset + 20).map(async ({ key }) => {
        const before = await store.getWithMetadata(key, { type: 'json' });
        const record = before?.data;
        stats.batchesScanned++;
        if (!Array.isArray(record?.entries)) return;
        const retained = record.entries.filter(entry => !isExpired(entry, now));
        const expired = record.entries.length - retained.length;
        if (!expired) return;
        stats.batchesAffected++;
        stats.expiredEntries += expired;
        if (dryRun) return;
        // An empty marker carries no event data and keeps retries of the original batch idempotent.
        const after = retained.length ? { ...record, entries: retained } : { expired: true };
        if (!before.etag || !(await store.setJSON(key, after, { onlyIfMatch: before.etag })).modified) {
          stats.conflicts++;
          return;
        }
        stats.entriesRemoved += expired;
        if (retained.length) stats.batchesRewritten++;
        else stats.batchesCleared++;
      }));
    }
  }
  return stats;
}
