import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Use these instead of next/link and next/navigation everywhere in the pages: they add the language to the
 * address (/en/...) and translate the page's name (pathnames.ts), so <Link href="/priser"> is /priser for
 * a Swedish visitor and /en/pricing for an English one.
 */
export const { Link, redirect, permanentRedirect, usePathname, useRouter, getPathname } = createNavigation(routing);

/**
 * An address as <Link href> and router.push() take it: "/priser", or { pathname: "/guider/[slug]", params: { slug } },
 * or { pathname: "/", hash: "faq" }, or { pathname: "/karta", query: { q } }. It is the router's own type, which is
 * the part of <Link>'s that both accept.
 */
export type Href = Parameters<ReturnType<typeof useRouter>["push"]>[0];
