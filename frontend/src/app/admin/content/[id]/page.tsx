import { notFound } from "next/navigation";
import { ContentEditor } from "@/components/admin/content/ContentEditor";
import { getContentById } from "@/lib/content/adminStore";

export const dynamic = "force-dynamic";

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  const item = await getContentById((await params).id);
  if (!item) notFound();
  return <ContentEditor item={item} />;
}
