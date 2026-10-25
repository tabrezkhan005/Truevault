// Built using Hyperiux Vault: https://vault.hyperiux.com
"use client";

import {
  type CSSProperties,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

/* Inline stand-in for @gsap/react's useGSAP. Mirrors its default
   `revertOnUpdate: false`: one gsap.context lives for the component's
   lifetime, the callback is re-added when dependencies change, and the
   context is reverted only on unmount. A callback may return its own
   cleanup, which runs before the next re-add and on unmount. */
function useGSAP(
  callback: () => void | (() => void),
  options?: {
    dependencies?: unknown[];
    scope?: { current: Element | null } | Element | null;
  },
) {
  const deps = options?.dependencies ?? [];
  const scope = options?.scope;
  const ctxRef = useRef<gsap.Context | null>(null);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);

  useLayoutEffect(() => {
    const el =
      scope && typeof scope === "object" && "current" in scope
        ? scope.current
        : (scope as Element | null);
    ctxRef.current = gsap.context(() => {}, el ?? undefined);
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = undefined;
      ctxRef.current?.revert();
      ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!ctxRef.current) return;
    cleanupRef.current?.();
    const ret = ctxRef.current.add(callback);
    cleanupRef.current = typeof ret === "function" ? ret : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export type TimelineJourneyItem = {
  id: string;
  label: string;
  content: string;
  lane: "top" | "bottom";
};

type SplitTextInstance = InstanceType<typeof SplitText>;

export type TimelineProps = {
  title?: string;
  periodLabel?: string;
  textColor?: string;
  mutedTextColor?: string;
  activeColor?: string;
  backgroundColor?: string;
  imageUrl?: string;
  imageAlt?: string;
  items?: TimelineJourneyItem[];
  /** Reveal animation duration, in seconds. */
  duration?: number;
  /** Fallback reveal duration when `duration` is omitted, in seconds. */
  scrollDuration?: number;
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQueryList.addEventListener("change", callback);

  return () => mediaQueryList.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") return false;

  return window.matchMedia?.(REDUCED_MOTION_QUERY)?.matches ?? false;
}

function getServerReducedMotionSnapshot() {
  return false;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot,
  );
}

/** TrustVault how-it-works defaults — upload → grant → enforce → prove. */
const defaultJourneyItems: TimelineJourneyItem[] = [
  {
    id: "upload",
    label: "01 · Upload",
    content: "Add a confidential file you own. Size, type, and name are checked before it is stored.",
    lane: "top",
  },
  {
    id: "grant",
    label: "02 · Grant",
    content: "Give named people read or edit access. No folder inheritance — only explicit grants count.",
    lane: "bottom",
  },
  {
    id: "authorize",
    label: "03 · Authorize",
    content: "Every request hits one server check. Hidden UI never grants access on its own.",
    lane: "top",
  },
  {
    id: "refuse",
    label: "04 · Refuse",
    content: "No grant means not found. The refusal is still written to the audit trail.",
    lane: "bottom",
  },
  {
    id: "audit",
    label: "05 · Audit",
    content: "Uploads, opens, edits, grants, and refusals land in an append-only, hash-chained log.",
    lane: "top",
  },
  {
    id: "revoke",
    label: "06 · Revoke",
    content: "Take access back and the next request fails. Nothing issued earlier keeps working.",
    lane: "bottom",
  },
  {
    id: "search",
    label: "07 · Search",
    content: "Find by name, owner, category, or date — only among documents you are allowed to see.",
    lane: "top",
  },
];

export default function Timeline({
  title = "How it works",
  periodLabel = "One path, seven checks",
  textColor = "var(--color-foreground, #ededed)",
  mutedTextColor = "var(--color-muted-foreground, #a3a3a3)",
  activeColor = "#2dd4bf",
  backgroundColor = "var(--color-background, #000000)",
  imageUrl = "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80",
  imageAlt = "Desk with documents and a laptop ready for secure sharing",
  items = defaultJourneyItems,
  duration,
  scrollDuration = 1.2,
}: TimelineProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const wholeSliderRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const animationDuration = duration ?? scrollDuration;
  const normalizedDuration = Math.max(0.2, animationDuration);
  const sectionStyle: CSSProperties = {
    color: textColor,
    backgroundColor,
  };
  const activeStyle: CSSProperties = {
    backgroundColor: activeColor,
  };
  const mutedTextStyle: CSSProperties = {
    color: mutedTextColor,
  };

  const topJourneyData = items.filter((item) => item.lane === "top");
  const bottomJourneyData = items.filter((item) => item.lane === "bottom");
  const allJourneyItems = items;

  useGSAP(
    () => {
      const section = sectionRef.current;

      if (!section) return;

      const isMobile = window.innerWidth < 600;
      const slidePercent = isMobile ? -57 : -65;
      const lineWidth = isMobile ? "65%" : "98%";
      const lineStart = isMobile ? "top 30%" : "top 25%";
      const slideEnd = isMobile ? "82% 50%" : "92% bottom";
      const lineEnd = isMobile ? "80% 50%" : "92% bottom";

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: slideEnd,
          scrub: true,
        },
        defaults: {
          ease: "none",
        },
      });

      tl.fromTo(
        wholeSliderRef.current,
        { xPercent: 0 },
        { xPercent: slidePercent },
      );

      if (reducedMotion) {
        gsap.set(".journey-line", { width: lineWidth });
        return;
      }

      gsap.to(".journey-line", {
        width: lineWidth,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: lineStart,
          end: lineEnd,
          scrub: true,
        },
      });
    },
    { dependencies: [reducedMotion], scope: sectionRef },
  );

  useGSAP(
    () => {
      const section = sectionRef.current;

      if (!section) return;

      if (reducedMotion) {
        allJourneyItems.forEach((item) => {
          gsap.set(`.jl-${item.id}`, { scaleY: 1 });
          gsap.set(`.jd-${item.id}`, { scale: 1 });
          gsap.set(`.title-${item.id}`, { opacity: 1, clearProps: "transform" });
          gsap.set(`.description-${item.id}`, {
            opacity: 1,
            clearProps: "transform",
          });
        });
        return;
      }

      allJourneyItems.forEach((item) => {
        gsap.set(`.jl-${item.id}`, {
          scaleY: 0,
          transformOrigin: "bottom bottom",
        });
        gsap.set(`.jd-${item.id}`, { scale: 0 });
        gsap.set(`.title-${item.id}`, { opacity: 1 });
        gsap.set(`.description-${item.id}`, { opacity: 1 });
      });

      const titleSplits: Partial<Record<string, SplitTextInstance>> = {};
      const descriptionSplits: Partial<Record<string, SplitTextInstance>> = {};

      allJourneyItems.forEach((item) => {
        titleSplits[item.id] = new SplitText(`.title-${item.id}`, {
          type: "chars, words, lines",
          mask: "lines",
        });

        descriptionSplits[item.id] = new SplitText(`.description-${item.id}`, {
          type: "chars, words, lines",
          mask: "lines",
        });
      });

      const createItemTimeline = (
        item: TimelineJourneyItem,
        startPos: number,
        endPos: number,
      ) => {
        const lineSelector = `.jl-${item.id}`;
        const dotSelector = `.jd-${item.id}`;
        const titleLines = titleSplits[item.id]?.lines || [];
        const descriptionLines = descriptionSplits[item.id]?.lines || [];

        if (item.lane === "bottom") {
          gsap.set(lineSelector, { transformOrigin: "top top" });
        }

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: `${startPos}% 30%`,
            end: `${endPos}% 50%`,
            scrub: true,
          },
        });

        timeline
          .to(lineSelector, {
            scaleY: 1,
            duration: normalizedDuration * 0.4,
          })
          .to(
            dotSelector,
            {
              scale: 1,
              duration: normalizedDuration * 0.4,
            },
            "<",
          )
          .fromTo(
            titleLines,
            { y: 100 },
            {
              y: 0,
              delay: -0.8 * normalizedDuration,
              duration: normalizedDuration,
              stagger: 0.02,
              ease: "power2.out",
            },
          )
          .fromTo(
            descriptionLines,
            { y: 100 },
            {
              y: 0,
              duration: normalizedDuration,
              stagger: 0.02,
              ease: "power2.out",
            },
            "<",
          );

        return timeline;
      };

      const positions: ReadonlyArray<readonly [number, number]> =
        window.innerWidth < 600
          ? [
              [22, 32],
              [28, 38],
              [36, 46],
              [45, 55],
              [52, 62],
              [60, 70],
              [69, 79],
            ]
          : [
              [6, 26],
              [16, 36],
              [26, 46],
              [35, 55],
              [45, 65],
              [55, 75],
              [65, 85],
            ];

      allJourneyItems.forEach((item, index) => {
        const pair = positions[index] ?? positions[positions.length - 1];
        const [startPos, endPos] = pair;
        createItemTimeline(item, startPos, endPos);
      });

      const handleResize = () => {
        ScrollTrigger.refresh();
      };

      window.addEventListener("resize", handleResize);

      return () => {
        Object.values(titleSplits).forEach((split) => split?.revert?.());
        Object.values(descriptionSplits).forEach((split) => split?.revert?.());
        window.removeEventListener("resize", handleResize);
      };
    },
    {
      dependencies: [normalizedDuration, reducedMotion, items],
      scope: sectionRef,
    },
  );

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="relative h-[200vw] w-full scroll-mt-24 max-[600px]:h-[400vh]"
      style={sectionStyle}
    >
      <div className="sticky top-0 h-dvh w-full overflow-x-clip overflow-y-hidden pt-[10%] max-[600px]:top-[5%]">
        <div
          ref={wholeSliderRef}
          className="mr-[2vw] flex h-[30vw] w-[240vw] max-w-none items-center gap-[5vw] px-[5vw] max-[600px]:h-[80vh] max-[600px]:w-[800vw] max-[600px]:px-[7vw]"
        >
          <div className="h-full w-[30vw] overflow-hidden rounded-[1vw] max-[600px]:h-[65vw] max-[600px]:w-[85vw] max-[600px]:rounded-[5vw]">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote Unsplash hero still; next/image would need remotePatterns */}
            <img
              src={imageUrl}
              alt={imageAlt}
              draggable={false}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="relative h-full w-full">
            <div className="absolute top-[49%] left-0 flex h-fit w-full translate-y-[-50%] items-center">
              <div
                className="h-[.8vw] w-[.8vw] rounded-full max-[600px]:h-[2vw] max-[600px]:w-[2vw]"
                style={activeStyle}
              />
              <div
                className="journey-line h-px w-[0%] rounded-full"
                style={activeStyle}
              />
              <div
                className="h-[.8vw] w-[.8vw] rounded-full max-[600px]:h-[2vw] max-[600px]:w-[2vw]"
                style={activeStyle}
              />
            </div>

            <div className="flex h-1/2 w-full items-center justify-start gap-[.5vw]">
              <div className="h-full w-[20%] pt-[2vw] max-[600px]:h-fit max-[600px]:pt-[5vw]">
                <h2
                  id="how-it-works-heading"
                  className="w-[65%] text-[3vw] leading-[0.95] max-[600px]:text-[8.5vw]"
                >
                  {title}
                </h2>
              </div>

              <div className="flex h-full w-full gap-x-[15vw] max-[600px]:gap-x-[40vw]">
                {topJourneyData.map((item) => (
                  <div
                    key={`top-${item.id}`}
                    className="relative h-full w-[30vw] px-[3vw] max-[600px]:flex max-[600px]:w-[70vw] max-[600px]:flex-col max-[600px]:px-[7vw]"
                  >
                    <div className="absolute top-0 bottom-0 left-0 h-full w-full">
                      <div
                        className={`jd-${item.id} relative aspect-square size-[1vw] translate-x-[-50%] rounded-full max-[600px]:size-[2.5vw]`}
                        style={activeStyle}
                      />
                      <div
                        className={`jl-${item.id} h-[94%] w-px origin-bottom rounded-full`}
                        style={activeStyle}
                      />
                    </div>

                    <div className="mt-[-1vw] space-y-[1vw] max-[600px]:mt-[-2vw]">
                      <h3
                        className={`title-${item.id} text-[2.5vw] leading-none max-[600px]:text-[6.4vw]`}
                      >
                        {item.label}
                      </h3>
                      <p
                        className={`description-${item.id} w-[90%] text-[1.5vw] leading-[1.15] max-[600px]:w-[90%] max-[600px]:text-[4.8vw]`}
                        style={mutedTextStyle}
                      >
                        {item.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex h-1/2 w-full items-center justify-start">
              <div className="h-full w-[34%] pt-[2vw] max-[600px]:w-[30%] max-[600px]:pt-[5vw]">
                <p
                  className="text-[1.65vw] leading-none max-[600px]:text-[4.2vw]"
                  style={mutedTextStyle}
                >
                  {periodLabel}
                </p>
              </div>

              <div className="ml-[7vw] flex h-full w-full gap-x-[20vw] max-[600px]:ml-[7vw] max-[600px]:gap-x-[40vw]">
                {bottomJourneyData.map((item) => (
                  <div
                    key={`bottom-${item.id}`}
                    className="relative h-full w-[25vw] px-[3vw] max-[600px]:w-[70vw] max-[600px]:px-[7vw]"
                  >
                    <div className="absolute bottom-[-1%] left-0 h-full w-full">
                      <div
                        className={`jl-${item.id} h-[94%] w-px origin-top rounded-full max-[600px]:h-full`}
                        style={activeStyle}
                      />
                      <div
                        className={`jd-${item.id} relative aspect-square size-[1vw] w-auto translate-x-[-50%] rounded-full max-[600px]:size-[2.5vw]`}
                        style={activeStyle}
                      />
                    </div>

                    <div className="flex h-full w-full flex-col justify-end space-y-[1vw]">
                      <h3
                        className={`title-${item.id} text-[2.5vw] leading-none max-[600px]:text-[6.4vw]`}
                      >
                        {item.label}
                      </h3>
                      <p
                        className={`description-${item.id} w-[90%] text-[1.5vw] leading-[1.15] max-[600px]:w-[90%] max-[600px]:text-[4.8vw]`}
                        style={mutedTextStyle}
                      >
                        {item.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
