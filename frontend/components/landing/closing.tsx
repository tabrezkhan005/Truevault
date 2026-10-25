"use client";

import StringTieFooter from "@/components/ui/string-tie-footer";

/**
 * Closing story for judges + interactive string-tie thank-you footer.
 * Static page only — no API calls.
 */
export function Closing() {
  return (
    <>
      <section
        aria-labelledby="whole-story-heading"
        className="relative z-10 border-t border-white/10 bg-black px-4 py-24"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
            TrustVault · hiring challenge
          </p>
          <h2
            id="whole-story-heading"
            className="text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl"
          >
            That&rsquo;s the whole story.
          </h2>
          <p className="max-w-xl text-lg leading-relaxed text-zinc-400">
            A smaller system that holds: every document is reachable only by
            grant, every attempt — including refusals — lands in an append-only,
            hash-chained audit log, and revoke works on the next request. Scroll
            for the seal.
          </p>
          <p className="text-sm text-zinc-500">
            Demo hosted on a free tier; the first request after idle time can
            take up to a minute.
          </p>
          <div className="mt-2 h-px w-full bg-white/10" />
        </div>
      </section>

      <StringTieFooter
        meta={["TrustVault", "2026", "Challenge"]}
        title="Thank"
        titleAccent="You"
        tapes={["Looking Forward to", "Connect with You!"]}
        email="tabrezkhangnt@gmail.com"
        phone=""
        links={[]}
        regards="Warm regards,"
        signature={[]}
        signatureText="Tabrez Khan"
        signatureLabel="Signed, Tabrez Khan"
        note={{
          kicker: "A note, tucked inside",
          text: "If you want to talk about TrustVault — the grants model, the audit chain, or the trade-offs — email me. I read every message.",
        }}
        height="100svh"
        accent="#2563eb"
        cord="#3b82f6"
        fontDisplay="var(--font-heading), var(--font-body), ui-sans-serif, system-ui, sans-serif"
        fontSans="var(--font-body), ui-sans-serif, system-ui, sans-serif"
        fontScript="var(--font-heading), var(--font-body), ui-sans-serif, system-ui, sans-serif"
      />
    </>
  );
}
