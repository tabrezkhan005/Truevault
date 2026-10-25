"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import gsap from "gsap";

import Login03, { type AuthMode } from "@/components/ui/login-03";

type AuthModalProps = {
  open: boolean;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onSuccess?: (user: { id: string; email: string; role: string }) => void;
};

/**
 * Large Hirael-style auth popup — nearly fills the viewport over a dimmed landing.
 */
export function AuthModal({
  open,
  mode,
  onModeChange,
  onClose,
  onSuccess,
}: AuthModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    if (reduceMotion) {
      gsap.set(panelRef.current, { clearProps: "all" });
      return;
    }

    gsap.fromTo(
      panelRef.current,
      { autoAlpha: 0, y: 36, scale: 0.97 },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.55,
        ease: "power3.out",
      },
    );
  }, [open, reduceMotion]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="auth-modal"
          className="fixed inset-0 z-100 flex items-center justify-center p-3 sm:p-6 md:p-8"
          role="presentation"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <button
            type="button"
            aria-label="Dismiss sign in"
            className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-dialog-title"
            className="relative z-10 w-full max-w-5xl shadow-2xl"
          >
            <span id="auth-dialog-title" className="sr-only">
              Sign in or join
            </span>
            <Login03
              mode={mode}
              onModeChange={onModeChange}
              onClose={onClose}
              onSuccess={onSuccess}
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
