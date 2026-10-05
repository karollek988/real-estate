import Image from "next/image";

/**
 * Full-bleed atmospheric backdrop for a dark section (the deep green
 * example-report band). Sits behind the content, heavily toned down, and
 * masked so it dissolves into the section colour at both the top and bottom
 * edges — no visible seam where the image starts. The parent section must be
 * `relative`, and its content must render above this layer (e.g. `relative`).
 */
export function SectionBackground({ src }: { src: string }) {
  return (
    <div aria-hidden="true" className="section-bg pointer-events-none absolute inset-0">
      <Image src={src} alt="" fill sizes="100vw" className="object-cover opacity-[0.2]" />
      <div className="absolute inset-0 bg-ka-green-950/60" />
    </div>
  );
}
