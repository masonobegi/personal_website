import { NextResponse } from "next/server";
import { indexNowKey } from "@/lib/indexNow";
import { SITE_URL } from "@/lib/seo";

const WWW_HOST = `www.${new URL(SITE_URL).host}`;

// Runs before every page request (see the matcher below).
//
//   • www.oswegolegacypartners.com/* → a permanent (301) redirect to the same
//     path on oswegolegacypartners.com, so there's only ever one version of
//     each page. This takes effect once a www DNS record points here.
//   • /<IndexNow key>.txt → the key, proving to Bing and the other IndexNow
//     engines that pings about new articles really come from this site.

// What the browser is allowed to load, and from where. Without this, anything
// that ever manages to get a script onto a page — a dependency, a stray bit of
// admin-entered markup — can send whatever it likes wherever it likes. On a
// site that collects names, emails and phone numbers for a regulated firm,
// that is the difference between a bug and a disclosure.
//
// Every inline script we write carries a one-time nonce generated per request.
// "strict-dynamic" lets the tags we do trust (Analytics, LinkedIn, Meta) load
// their own helpers, while everything else stays shut. The trailing
// "unsafe-inline" and "https:" are ignored by any browser that understands
// nonces and strict-dynamic; they are there so an older one still gets a
// working site rather than a blank one.
function contentSecurityPolicy(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    // React writes styles as attributes on elements, and Next inlines a
    // stylesheet; neither can carry a nonce.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://px.ads.linkedin.com https://www.facebook.com",
    // The scheduling widget and the LinkedIn video cards.
    //
    // bookings.cloud.microsoft has to be here even though the embed's address is
    // an outlook.office.com one: Microsoft has moved Bookings onto its new
    // cloud.microsoft domain and redirects there, and frame-src is checked
    // against where a frame actually lands, not where it was pointed. Allowing
    // only the old host left the booking calendar on /intake a blank grey box.
    "frame-src 'self' https://outlook.office.com https://outlook.office365.com https://bookings.cloud.microsoft https://www.linkedin.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function proxy(request) {
  const host = (request.headers.get("host") || "").toLowerCase();
  const { pathname, search } = request.nextUrl;

  // Redirect to this site's own address rather than to whatever the request
  // claimed to be for. The Host header is set by the caller, so echoing it back
  // means anyone can hand out a link to this domain that bounces the visitor
  // to a site of their choosing.
  if (host === WWW_HOST) {
    return NextResponse.redirect(`${SITE_URL}${pathname}${search}`, 301);
  }

  if (pathname.endsWith(".txt")) {
    const key = indexNowKey();
    if (key && pathname === `/${key}.txt`) {
      return new NextResponse(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  }

  // A fresh nonce per request, handed to the page so its inline scripts can
  // declare themselves, and named in the policy so nothing else can.
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
  return response;
}

// Kept off API routes, uploaded files, and Next's own assets. Besides being
// unnecessary there, running the proxy on a request makes Next buffer its body
// with a 10 MB cap — which would break large uploads and backup restores.
export const config = {
  matcher: ["/((?!api/|_next/|media/|favicon\\.ico|icon\\.svg).*)"],
};
