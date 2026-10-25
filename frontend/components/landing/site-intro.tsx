"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const INTRO_LINE = "Documents only the right people can reach.";

interface SiteIntroProps {
  onComplete: () => void;
}

/**
 * Full-viewport opener: Raleway typewriter, then a smooth GSAP handoff to the landing.
 * Font comes from layout (--font-raleway). Static only — no API.
 */
export function SiteIntro({ onComplete }: SiteIntroProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      const line = lineRef.current;
      const cursor = cursorRef.current;
      const veil = veilRef.current;
      if (!root || !line || !cursor || !veil) return;

      let cancelled = false;
      let blink: gsap.core.Tween | null = null;

      const finish = () => {
        blink?.kill();
        if (!cancelled) onComplete();
      };

      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      const run = () => {
        if (cancelled) return;

        if (reduce) {
          line.textContent = INTRO_LINE;
          gsap.set(cursor, { opacity: 0 });
          gsap.to(root, {
            opacity: 0,
            duration: 0.35,
            ease: "power2.out",
            onComplete: finish,
          });
          return;
        }

        const state = { n: 0 };
        line.textContent = "";

        // Separate from the main timeline — infinite repeat must not block onComplete.
        blink = gsap.to(cursor, {
          opacity: 0,
          duration: 0.45,
          repeat: -1,
          yoyo: true,
          ease: "steps(1)",
          delay: 0.15,
        });

        const tl = gsap.timeline({
          defaults: { ease: "power3.inOut" },
          onComplete: finish,
        });

        tl.fromTo(
          veil,
          { opacity: 0 },
          { opacity: 1, duration: 0.4, ease: "power2.out" }
        );

        tl.to(
          state,
          {
            n: INTRO_LINE.length,
            duration: Math.min(2.8, INTRO_LINE.length * 0.042),
            ease: "none",
            onUpdate: () => {
              line.textContent = INTRO_LINE.slice(0, Math.floor(state.n));
            },
          },
          0.35
        );

        tl.to({}, { duration: 0.7 });

        tl.add(() => {
          blink?.kill();
          blink = null;
          gsap.set(cursor, { opacity: 0 });
        });

        tl.to(line, {
          scale: 1.05,
          duration: 0.35,
          ease: "power2.out",
        });

        tl.to(
          line,
          {
            scale: 1.45,
            opacity: 0,
            filter: "blur(12px)",
            y: -24,
            duration: 0.75,
            ease: "power3.in",
          },
          "+=0.05"
        );

        tl.to(
          root,
          {
            opacity: 0,
            duration: 0.55,
            ease: "power2.inOut",
          },
          "-=0.4"
        );
      };

      // Wait until layout-preloaded Raleway is ready — no fallback glyphs mid-type.
      const waitFonts = document.fonts?.ready ?? Promise.resolve();
      waitFonts.then(run).catch(run);

      return () => {
        cancelled = true;
        blink?.kill();
      };
    },
    { scope: rootRef }
  );

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-100 flex items-center justify-center overflow-hidden bg-black"
      role="status"
      aria-live="polite"
      aria-label="Site introduction"
    >
      <div
        ref={veilRef}
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.2),transparent_55%)]"
        aria-hidden="true"
      />
      <p className="font-raleway relative z-10 max-w-[min(100%-2rem,72rem)] px-4 text-center text-[clamp(1.15rem,calc(0.85rem+3.2vw),3.25rem)] font-medium tracking-tight text-balance text-white">
        <span ref={lineRef} />
        <span
          ref={cursorRef}
          className="ml-0.5 inline-block w-[0.08em] shrink-0 translate-y-[0.05em] bg-white align-baseline"
          style={{ height: "0.95em" }}
          aria-hidden="true"
        />
      </p>
    </div>
  );
}
