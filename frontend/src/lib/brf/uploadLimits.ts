/**
 * Upload constants shared by the browser (the upload buttons) and the server
 * (api/properties/[id]/brf-report/*). Kept free of server imports so client
 * components can use them.
 */

export const BRF_REPORTS_BUCKET = "brf-annual-reports";

/** Max size for an uploaded BRF annual report (PDF/docx/image). Enforced
 * both when issuing the upload URL (against the client's declared size) and
 * again server-side against the actual downloaded bytes. */
export const MAX_BRF_REPORT_BYTES = 20 * 1024 * 1024; // 20MB — annual reports can run many pages

/** What the upload buttons accept — the same set classifyBrfMimeType() allows. */
export const BRF_REPORT_ACCEPT = ".pdf,.docx,image/*";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Maps an uploaded file's declared MIME type to the Python engine's
 * file_kind + a storage extension, or null if unsupported. */
export function classifyBrfMimeType(mimeType: string): { fileKind: "pdf" | "docx" | "image"; extension: string } | null {
  if (mimeType === "application/pdf") return { fileKind: "pdf", extension: "pdf" };
  if (mimeType === DOCX_MIME) return { fileKind: "docx", extension: "docx" };
  if (mimeType.startsWith("image/")) {
    const extension = mimeType.split("/")[1]?.split("+")[0] || "img";
    return { fileKind: "image", extension };
  }
  return null;
}
