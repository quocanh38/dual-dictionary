/* Shared SEO helpers for Dual Dictionary static builders.
 * Centralizes safe JSON-LD serialization (preventing </script> breakout),
 * HTML escaping, and canonical site constants. */
'use strict';

const SITE = 'https://hocta.app';
const UPDATED_DATE = '07/11/2026';

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Serialize JSON-LD safely for embedding inside <script type="application/ld+json">.
 *  Escapes '<' as \u003c so no string can break out of the script tag. */
function safeJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

module.exports = { SITE, UPDATED_DATE, escapeHtml, safeJsonLd };
