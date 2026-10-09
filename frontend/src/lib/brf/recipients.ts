/**
 * Who hears what when a reviewer publishes (lib/brf/notify.ts):
 *  - "report": the customer's own report was released just now — "your report is ready".
 *  - "brf":    the customer already had a released report and the BRF figures were
 *              published or updated — "your housing association analysis is ready".
 * A customer whose report still waits for release gets nothing yet; they hear when
 * theirs is released. A customer who is in both groups gets the report e-mail.
 *
 * Pure on purpose, so recipients.verify.mjs can check it without a database.
 */
export type ReviewMail = "report" | "brf";

export function reviewMailRecipients(
  requests: ReadonlyArray<{ userId: string; analysisId: string }>,
  options: { releasedIds: ReadonlySet<string>; stillWaitingIds: ReadonlySet<string>; brfPublished: boolean }
): Map<string, ReviewMail> {
  const recipients = new Map<string, ReviewMail>();
  for (const { userId, analysisId } of requests) {
    if (options.stillWaitingIds.has(analysisId)) continue;
    if (options.releasedIds.has(analysisId)) {
      recipients.set(userId, "report");
    } else if (options.brfPublished && !recipients.has(userId)) {
      recipients.set(userId, "brf");
    }
  }
  return recipients;
}
