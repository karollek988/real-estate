import Image from "next/image";

/**
 * Full-bleed atmospheric backdrop for a section. Sits behind the content,
 * heavily darkened, and masked so it dissolves into the page background at
 * both the top and bottom edges — no visible seam where the image starts.
 * The parent section must be `relative`, and its content must render above
 * this layer (e.g. `relative`).
 */
export function SectionBackground({ src }: { src: string }) {
  return (
    <div aria-hidden="true" className="section-bg pointer-events-none absolute inset-0">
      <Image src={src} alt="" fill sizes="100vw" className="object-cover opacity-[0.22]" />
      <div className="absolute inset-0 bg-[#111927]/55" />
    </div>
  );
}
