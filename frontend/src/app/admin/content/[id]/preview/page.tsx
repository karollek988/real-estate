import { notFound } from "next/navigation";
import { ContentArticle } from "@/components/kunskap/ContentArticle";
import { displaySerif } from "@/lib/fonts";
import { getContentById } from "@/lib/content/adminStore";
import { listPublishedContent, relatedContent } from "@/lib/content/repository";

export const dynamic = "force-dynamic";

/**
 * /admin/content/:id/preview - the item exactly as its public page will show
 * it, drafts included. Inside the admin console, so only admins see a draft
 * (and the console is noindex).
 */
export default async function PreviewContentPage({ params }: { params: Promise<{ id: string }> }) {
  const item = await getContentById((await params).id);
  if (!item) notFound();
  const related = relatedContent(item, await listPublishedContent(item.type));

  return (
    <div className={`${displaySerif.variable} -mx-4 -my-6 overflow-hidden bg-ka-cream text-ka-text sm:-mx-6`}>
      <ContentArticle item={{ ...item, publishedAt: item.publishedAt ?? new Date().toISOString() }} related={related} preview />
    </div>
  );
}
