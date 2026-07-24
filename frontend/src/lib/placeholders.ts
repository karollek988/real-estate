/**
 * PLACEHOLDER values that are NOT backed by real systems yet.
 *
 * Everything in this module must be replaced by a real implementation before
 * launch; keeping them here (instead of scattered through components) makes
 * the remaining fake data auditable at a glance.
 */

/**
 * Free Decision Preview quota shown in the report top bar. There is no
 * per-user quota system yet (product rule: 3 free previews/month).
 */
export const PLACEHOLDER_FREE_PREVIEWS = {
  remaining: 2,
  total: 3,
} as const;
