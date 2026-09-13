import { headers } from "next/headers";

// The one-time value set by src/proxy.js for this request. Every inline script
// we emit carries it, which is what lets the Content-Security-Policy refuse
// every inline script we did not write.
export async function scriptNonce() {
  try {
    return (await headers()).get("x-nonce") || undefined;
  } catch {
    // Rendered outside a request (a static page, a build-time pass). No nonce
    // is needed there because no response header is being set either.
    return undefined;
  }
}
