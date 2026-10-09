import { NextResponse } from "next/server";

/**
 * Browsers ask for /favicon.ico on their own (error pages, bots, the headless browser that prints the PDF) although
 * the site's icon is src/app/icon.png. With no route here the request fell into the [locale] page tree and the
 * server answered 500 ("Page changed from static to dynamic at runtime /favicon.ico"). Send them to the icon.
 */
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/icon.png", request.url), 308);
}
