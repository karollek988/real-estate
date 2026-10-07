/**
 * Pictures the content editor can choose from: the photos already on the site
 * (below, each with a suggested alt text) and pictures uploaded from the editor
 * (imageUpload.ts), which live in the public Supabase Storage bucket
 * "content-images".
 *
 * Only those two kinds are accepted (isAllowedImage): a published item can
 * never point at someone else's server, and next/image only needs the one
 * remote pattern for our own bucket (next.config.ts).
 */
export interface ContentImage {
  src: string;
  label: string;
  alt: string;
}

export const CONTENT_IMAGES: ContentImage[] = [
  {
    src: "/images/bostadsguiden/stockholm-strandvagen.jpg",
    label: "Strandvägen, Stockholm",
    alt: "Stenhus och båtar längs Strandvägen i Stockholm en solig dag",
  },
  {
    src: "/images/bostadsguiden/gamla-stan-gata.jpg",
    label: "Gata i Gamla stan",
    alt: "Kullerstensgata i Gamla stan i kvällssol med cyklar längs husväggen",
  },
  {
    src: "/images/bostadsguiden/tunnelbana.jpg",
    label: "Tunnelbanestation",
    alt: "Rulltrappor i en tunnelbanestation i Stockholm med blåmålat bergtak",
  },
  {
    src: "/images/bostadsguiden/bussar.jpg",
    label: "Bussar i Stockholm",
    alt: "Röda bussar uppställda sida vid sida i Stockholm, sedda ovanifrån",
  },
  {
    src: "/images/brf-matter.png",
    label: "Flerbostadshus i kvällsljus",
    alt: "Flerbostadshus i kvällsljus med ett stigande diagram bredvid",
  },
  {
    src: "/images/infrastructure.png",
    label: "Pendeltåg och bostäder",
    alt: "Pendeltåg på väg ut ur en tunnel bredvid flerbostadshus på kvällen",
  },
  {
    src: "/understand-market.png",
    label: "Villa och marknadsdata",
    alt: "Villa i skymning med en grafisk kurva över bostadsmarknaden",
  },
  {
    src: "/hero-background.png",
    label: "Villaområde med priser",
    alt: "Villaområde från ovan med prisuppgifter över husen",
  },
];

const LOCAL_IMAGE = /^\/(?!\/)[A-Za-z0-9/_.-]+\.(?:jpe?g|png|webp|avif)$/;
const UPLOADED_FILE = /^[A-Za-z0-9_.-]+\.(?:jpe?g|png|webp|avif)$/;

/** The Supabase Storage bucket for uploaded pictures (public read, written only by the server). */
export const CONTENT_IMAGES_BUCKET = "content-images";

/** A picture served by the site itself: "/images/x.jpg", no "..", no other host. */
export function isLocalImagePath(value: string): boolean {
  return LOCAL_IMAGE.test(value) && !value.includes("..");
}

/** Where uploaded pictures are served from: https://<project>.supabase.co/storage/v1/object/public/content-images/ */
export function uploadedImagePrefix(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? `${url.replace(/\/$/, "")}/storage/v1/object/public/${CONTENT_IMAGES_BUCKET}/` : null;
}

/** An uploaded picture in our own bucket: one plain file name after the prefix, no "..", no folders. */
export function isUploadedImageUrl(value: string): boolean {
  const prefix = uploadedImagePrefix();
  if (!prefix || !value.startsWith(prefix)) return false;
  const name = value.slice(prefix.length);
  return UPLOADED_FILE.test(name) && !name.includes("..");
}

/** A picture an item may use: one of the site's own, or one uploaded to our bucket. */
export function isAllowedImage(value: string): boolean {
  return isLocalImagePath(value) || isUploadedImageUrl(value);
}

/** A full address for sharing and structured data: uploaded pictures already have one, the site's own get the site's. */
export function absoluteImageUrl(src: string, site: string): string {
  return /^https?:\/\//.test(src) ? src : `${site}${src}`;
}

export function findContentImage(src: string | null | undefined): ContentImage | undefined {
  return CONTENT_IMAGES.find((image) => image.src === src);
}
