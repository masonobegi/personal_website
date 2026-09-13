import Script from "next/script";
import AttributionCapture from "@/components/AttributionCapture";
import { cleanTracking } from "@/lib/tracking";
import { scriptNonce } from "@/lib/nonce";

// Analytics and ad-platform tags. Each one renders only when its ID is set in
// the admin (Content → Ads & Tracking); with nothing set, the site loads no
// third-party scripts at all.
//
//   Google Analytics 4   G-XXXXXXXXXX   (or the NEXT_PUBLIC_GA_ID variable)
//   Google Ads           AW-XXXXXXXXX   + a conversion label for leads
//   LinkedIn Insight     partner ID     + a conversion ID for leads
//   Meta Pixel           pixel ID
//
// The IDs end up inside inline scripts, so each is checked against its exact
// format first; anything else is ignored rather than injected.


export default async function Tracking({ tracking }) {
  const t = cleanTracking(tracking);
  const gtagId = t.ga4Id || t.googleAdsId;
  const nonce = await scriptNonce();

  return (
    <>
      {/* What the client-side lead tracker needs to report a conversion. */}
      <script
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: `window.__olpTracking=${JSON.stringify({
            googleAds: t.googleAdsId && t.googleAdsLeadLabel ? `${t.googleAdsId}/${t.googleAdsLeadLabel}` : "",
            linkedinConversion: t.linkedinLeadConversionId,
            meta: Boolean(t.metaPixelId),
            ga4: Boolean(t.ga4Id),
          })};`,
        }}
      />
      <AttributionCapture metaPixel={Boolean(t.metaPixelId)} />

      {gtagId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`}
            nonce={nonce}
            strategy="afterInteractive"
          />
          <Script id="gtag-init" nonce={nonce} strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              ${t.ga4Id ? `gtag('config', '${t.ga4Id}', { anonymize_ip: true });` : ""}
              ${t.googleAdsId ? `gtag('config', '${t.googleAdsId}');` : ""}
            `}
          </Script>
        </>
      )}

      {t.linkedinPartnerId && (
        <Script id="linkedin-insight" nonce={nonce} strategy="afterInteractive">
          {`
            window._linkedin_partner_id = "${t.linkedinPartnerId}";
            window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
            window._linkedin_data_partner_ids.push(window._linkedin_partner_id);
            (function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};
            window.lintrk.q=[]}var s=document.getElementsByTagName("script")[0];
            var b=document.createElement("script");b.type="text/javascript";b.async=true;
            b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";
            s.parentNode.insertBefore(b,s);})(window.lintrk);
          `}
        </Script>
      )}

      {t.metaPixelId && (
        <Script id="meta-pixel" nonce={nonce} strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
            n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
            document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${t.metaPixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
