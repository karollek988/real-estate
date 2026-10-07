/**
 * Pictures the content editor can choose from - photos already on the site,
 * each with a suggested alt text. Uploading new pictures is a later step; until
 * then a picture is added by putting the file in public/images/ and listing it
 * here.
 *
 * Only local paths are accepted (isLocalImagePath): next/image then optimises
 * them without a remote-image allowlist, and a published item can never point
 * at someone else's server.
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

/** A picture served by the site itself: "/images/x.jpg", no "..", no other host. */
export function isLocalImagePath(value: string): boolean {
  return LOCAL_IMAGE.test(value) && !value.includes("..");
}

export function findContentImage(src: string | null | undefined): ContentImage | undefined {
  return CONTENT_IMAGES.find((image) => image.src === src);
}
