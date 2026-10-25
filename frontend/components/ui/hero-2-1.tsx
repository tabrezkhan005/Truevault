"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { ActivityProofSection } from "@/components/landing/activity-proof";
import { AuditIllustration } from "@/components/landing/audit-illustration";
import { HowItWorksSection } from "@/components/landing/how-it-works";
import { Closing } from "@/components/landing/closing";
import { SignInLink } from "@/components/landing/sign-in-link";
import type { AuthMode } from "@/components/ui/login-03";
import logoBg from "@/assets/logo/logobg.png";

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/** logobg.png is a square with large baked-in padding — crop it so the nav sits flush. */
function BrandLogo({ className }: { className?: string }) {
  return (
    <span
      className={
        className ??
        "relative block h-9 w-[9.5rem] overflow-hidden sm:h-10 sm:w-[10.5rem]"
      }
    >
      <Image
        src={logoBg}
        alt="TrustVault"
        className="absolute top-1/2 left-0 h-[210%] w-auto max-w-none -translate-y-1/2"
        priority
      />
    </span>
  );
}

type Hero2Props = {
  onOpenAuth?: (mode: AuthMode) => void;
};

const Hero2 = ({ onOpenAuth }: Hero2Props) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuId = useId();
  const prefersReducedMotion = useReducedMotion();

  const closeMenu = useCallback(() => setMobileMenuOpen(false), []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen, closeMenu]);

  return (
    <div className="relative overflow-x-clip bg-black">
      {/* Exactly one viewport — Admin Preview only after scroll */}
      <section className="relative flex h-svh min-h-svh flex-col overflow-hidden">
        <div className="absolute -right-60 -top-10 z-0 flex flex-col items-end blur-xl">
          <div className="z-1 h-[10rem] w-[60rem] rounded-full bg-linear-to-b from-indigo-600 to-sky-700 blur-[6rem]" />
          <div className="z-1 h-[10rem] w-[90rem] rounded-full bg-linear-to-b from-teal-800 to-cyan-600 blur-[6rem]" />
          <div className="z-1 h-[10rem] w-[60rem] rounded-full bg-linear-to-b from-blue-700 to-indigo-500 blur-[6rem]" />
        </div>
        <div className="absolute inset-0 z-0 bg-noise opacity-30" />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <header className="shrink-0">
            <nav
              className="container mx-auto flex items-center justify-between px-4 py-2"
              aria-label="Primary"
            >
              <Link
                href="/"
                className="flex items-center rounded-sm focus-visible:outline-offset-4"
              >
                <BrandLogo />
              </Link>

              <div className="hidden items-center space-x-6 md:flex">
                <div className="flex items-center space-x-6">
                  <a
                    href="#how-it-works"
                    className="text-sm text-gray-300 hover:text-white"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToId("how-it-works");
                    }}
                  >
                    How it works
                  </a>
                  <a
                    href="#activity"
                    className="text-sm text-gray-300 hover:text-white"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToId("activity");
                    }}
                  >
                    Activity
                  </a>
                </div>
                <SignInLink
                  onOpenAuth={onOpenAuth}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-white px-8 text-base font-medium text-black hover:bg-white/90"
                >
                  Sign in
                </SignInLink>
              </div>

              <button
                type="button"
                className="rounded md:hidden"
                aria-expanded={mobileMenuOpen}
                aria-controls={menuId}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                onClick={() => setMobileMenuOpen((open) => !open)}
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6 text-white" aria-hidden="true" />
                ) : (
                  <Menu className="h-6 w-6 text-white" aria-hidden="true" />
                )}
              </button>
            </nav>
          </header>

          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                id={menuId}
                role="dialog"
                aria-modal="true"
                aria-label="Mobile navigation"
                initial={prefersReducedMotion ? false : { y: "-100%" }}
                animate={{ y: 0 }}
                exit={prefersReducedMotion ? undefined : { y: "-100%" }}
                transition={
                  prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }
                }
                className="fixed inset-0 z-50 flex flex-col bg-black/95 p-4 md:hidden"
              >
                <div className="flex items-center justify-between">
                  <BrandLogo className="relative block h-9 w-[9.5rem] overflow-hidden" />
                  <button
                    type="button"
                    aria-label="Close menu"
                    onClick={closeMenu}
                  >
                    <X className="h-6 w-6 text-white" aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-8 flex flex-col space-y-6">
                  <a
                    href="#how-it-works"
                    className="flex items-center justify-between border-b border-gray-800 pb-2 text-lg text-white"
                    onClick={(e) => {
                      e.preventDefault();
                      closeMenu();
                      scrollToId("how-it-works");
                    }}
                  >
                    <span>How it works</span>
                    <ArrowRight
                      className="h-4 w-4 text-gray-400"
                      aria-hidden="true"
                    />
                  </a>
                  <a
                    href="#activity"
                    className="flex items-center justify-between border-b border-gray-800 pb-2 text-lg text-white"
                    onClick={(e) => {
                      e.preventDefault();
                      closeMenu();
                      scrollToId("activity");
                    }}
                  >
                    <span>Activity</span>
                    <ArrowRight
                      className="h-4 w-4 text-gray-400"
                      aria-hidden="true"
                    />
                  </a>
                  <div className="pt-4">
                    <SignInLink
                      onOpenAuth={onOpenAuth}
                      onNavigate={closeMenu}
                      className="inline-flex h-12 w-full items-center justify-center rounded-full border border-gray-700 text-white hover:bg-white/10"
                    >
                      Sign in
                    </SignInLink>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <main className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-1 sm:pb-6">
            <div className="mx-auto flex max-w-fit shrink-0 items-center justify-center space-x-2 rounded-full bg-white/10 px-4 py-1.5 backdrop-blur-sm">
              <span className="text-sm font-medium text-white">
                Every access attempt is recorded
              </span>
              <ArrowRight className="h-4 w-4 text-white" aria-hidden="true" />
            </div>

            <div className="container mx-auto mt-3 flex min-h-0 max-w-6xl flex-1 flex-col text-center sm:mt-4">
              <h1 className="mx-auto max-w-4xl shrink-0 text-3xl font-bold leading-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
                Documents only the right people can reach.
              </h1>
              <p className="mx-auto mt-3 max-w-2xl shrink-0 text-sm text-gray-300 sm:mt-4 sm:text-base md:text-lg">
                Share confidential files with named people, take access back
                instantly, and see exactly who opened what, including the
                attempts that were refused.
              </p>
              <div className="mt-4 flex shrink-0 flex-col items-center justify-center space-y-3 sm:mt-6 sm:flex-row sm:space-x-4 sm:space-y-0">
                <SignInLink
                  onOpenAuth={onOpenAuth}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-white px-8 text-base font-medium text-black hover:bg-white/90"
                >
                  Sign in
                </SignInLink>
                <a
                  href="#how-it-works"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-gray-600 px-8 text-base font-medium text-white hover:bg-white/10"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToId("how-it-works");
                  }}
                >
                  See how it works
                </a>
              </div>

              <div className="mt-4 flex min-h-0 flex-1 flex-col justify-end sm:mt-5">
                <AuditIllustration compact />
              </div>
            </div>
          </main>
        </div>
      </section>

      <ActivityProofSection />
      <HowItWorksSection />
      <Closing />
    </div>
  );
};

export { Hero2 };
