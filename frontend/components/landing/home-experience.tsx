"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { Hero2 } from "@/components/ui/hero-2-1";
import { SiteIntro } from "@/components/landing/site-intro";
import { AuthModal } from "@/components/landing/auth-modal";
import { useAuth } from "@/components/app/auth-provider";
import type { AuthMode } from "@/components/ui/login-03";
import type { AuthUser } from "@/lib/api";
import { homeForUser } from "@/lib/role-home";
import { safeRedirectPath } from "@/lib/safe-redirect";

gsap.registerPlugin(useGSAP);

/**
 * Client shell: GSAP intro overlay, then the static landing + auth popup.
 */
export function HomeExperience() {
  const [introDone, setIntroDone] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const landingRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { setUser } = useAuth();

  const finishIntro = useCallback(() => {
    setIntroDone(true);
  }, []);

  const openAuth = useCallback((mode: AuthMode = "signin") => {
    setAuthMode(mode);
    setAuthOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setAuthOpen(false);
  }, []);

  const onAuthSuccess = useCallback(
    (user: AuthUser) => {
      setUser(user);
      const fallback = homeForUser(user);
      // Optional ?next= must be same-origin relative; never open-redirect.
      const params =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : null;
      const next = safeRedirectPath(params?.get("next") ?? null, fallback);
      router.push(next.startsWith("/") ? next : fallback);
    },
    [router, setUser],
  );

  useEffect(() => {
    if (introDone) return;

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [introDone]);

  useGSAP(
    () => {
      const el = landingRef.current;
      if (!el) return;

      if (!introDone) {
        gsap.set(el, { autoAlpha: 0, y: 0 });
        return;
      }

      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      gsap.fromTo(
        el,
        { autoAlpha: 0, y: reduce ? 0 : 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: reduce ? 0.3 : 0.85,
          ease: "power3.out",
          clearProps: "transform",
        },
      );
    },
    { dependencies: [introDone] },
  );

  return (
    <>
      {!introDone && <SiteIntro onComplete={finishIntro} />}
      <div
        ref={landingRef}
        data-page-shell
        className={
          introDone
            ? undefined
            : "pointer-events-none fixed inset-0 overflow-hidden"
        }
        aria-hidden={!introDone}
      >
        <Hero2 onOpenAuth={openAuth} />
      </div>
      <AuthModal
        open={authOpen}
        mode={authMode}
        onModeChange={setAuthMode}
        onClose={closeAuth}
        onSuccess={onAuthSuccess}
      />
    </>
  );
}
