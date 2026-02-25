import { NextResponse } from "next/server";

export const config = {
  matcher: "/integrations/:path*",
};

export function middleware(request) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-createxyz-project-id", "679267a8-adeb-42e6-942e-b3a71e365329");
  requestHeaders.set("x-createxyz-project-group-id", "4356d516-944b-439e-a932-fffdf8ebad42");


  request.nextUrl.href = `https://www.anything.com/${request.nextUrl.pathname}`;

  return NextResponse.rewrite(request.nextUrl, {
    request: {
      headers: requestHeaders,
    },
  });
}