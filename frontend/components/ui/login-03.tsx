// Login 3 from Hirael <https://hirael.com/blocks/auth/login-03>
// MIT · Mohammad Shehadeh · https://github.com/MohammadShehadeh/hirael
// TrustVault: modal popup matching the Hirael split layout + email/password.

"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { loginWithPassword } from "@/lib/auth-api";
import { Button } from "@/components/ui/button";
import logoBg from "@/assets/logo/logobg.png";

export type AuthMode = "signin" | "signup";

export type Login03Props = {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onSuccess?: (user: { id: string; email: string; role: string }) => void;
};

const jitter = (i: number) => {
  const value = Math.sin(i + 1) * 10_000;
  return value - Math.floor(value);
};

function FloatingPaths({ position }: { position: number }) {
  const reduceMotion = useReducedMotion();
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        className="h-full w-full text-primary"
        fill="none"
        viewBox="0 0 696 316"
      >
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            initial={{ pathLength: 0.3 }}
            animate={
              reduceMotion
                ? undefined
                : { pathLength: 1, pathOffset: [0, 1, 0] }
            }
            stroke="currentColor"
            className="opacity-60"
            strokeOpacity={0.1 + path.id * 0.03}
            strokeWidth={path.width}
            transition={{
              duration: 20 + jitter(path.id) * 10,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  );
}

function BrandLockup() {
  return (
    <span className="relative block h-8 w-[8.5rem] overflow-hidden">
      <Image
        src={logoBg}
        alt="TrustVault"
        className="absolute top-1/2 left-0 h-[210%] w-auto max-w-none -translate-y-1/2"
        priority
      />
    </span>
  );
}

const fieldClass =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Hirael-style split auth panel for the landing popup.
 * Mode switches crossfade in place — no remount / route change.
 */
export default function Login03({
  mode,
  onModeChange,
  onClose,
  onSuccess,
}: Login03Props) {
  const reduceMotion = useReducedMotion();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [signupNotice, setSignupNotice] = React.useState<string | null>(null);

  const isSignIn = mode === "signin";
  const duration = reduceMotion ? 0 : 0.32;

  function switchMode(next: AuthMode) {
    if (next === mode) return;
    setError(null);
    setSignupNotice(null);
    onModeChange(next);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSignupNotice(null);

    if (mode === "signup") {
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
      setSignupNotice(
        "Accounts are created by an admin for this challenge. Use a seed account to sign in.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await loginWithPassword(email.trim(), password);
      if (!result.ok) {
        setError(result.detail);
        return;
      }
      onSuccess?.(result.user);
      onClose();
    } catch {
      setError("Could not reach the server. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-slot="login"
      className="relative grid h-[min(88vh,760px)] w-full overflow-hidden rounded-2xl border border-border bg-background lg:grid-cols-2"
    >
      <aside
        data-slot="login-aside"
        className="relative hidden h-full flex-col overflow-hidden border-e border-border bg-card p-10 lg:flex"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, transparent, transparent, var(--background))",
          }}
        />
        <div className="absolute inset-0">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>

        <div className="relative z-10">
          <BrandLockup />
        </div>

        <figure className="relative z-10 mt-auto flex flex-col gap-3">
          <blockquote className="font-heading text-2xl leading-[1.25] tracking-tight md:text-3xl">
            We wired grants and an audit chain in a week —{" "}
            <span className="italic text-foreground">
              and every refusal still shows up
            </span>
            . The source lives in the repo, so it bends to the rules.
          </blockquote>
          <figcaption className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
            <span>TrustVault</span>
            <span aria-hidden className="text-border">
              |
            </span>
            <span>Hiring challenge</span>
          </figcaption>
        </figure>
      </aside>

      <div
        data-slot="login-main"
        className="relative flex h-full flex-col justify-center overflow-y-auto px-8 py-12"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 opacity-60"
        >
          <div
            className="absolute end-0 top-0 h-80 w-72 -translate-y-1/3 rounded-full"
            style={{
              background:
                "radial-gradient(68% 69% at 55% 31%, color-mix(in oklab, var(--foreground) 6%, transparent) 0, transparent 80%)",
            }}
          />
        </div>

        <Button
          type="button"
          variant="ghost"
          className="absolute start-5 top-7 z-10 gap-1.5"
          onClick={onClose}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
          Home
        </Button>

        <div
          data-slot="login-panel"
          className="relative z-10 mx-auto w-full space-y-6 sm:max-w-sm"
        >
          <div className="flex items-center gap-2 lg:hidden">
            <BrandLockup />
          </div>

          <div data-slot="login-header" className="flex flex-col gap-2">
            <h2 className="font-heading text-4xl font-medium tracking-tight sm:text-5xl">
              Sign in or join.
            </h2>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={mode}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration, ease }}
                className="text-sm text-muted-foreground"
              >
                {isSignIn
                  ? "Email and password. Sessions are HttpOnly — nothing in localStorage."
                  : "Self-serve signup is closed for this challenge. Ask an admin, or sign in with a seed account."}
              </motion.p>
            </AnimatePresence>
          </div>

          <div
            className="relative grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1"
            role="tablist"
            aria-label="Auth mode"
          >
            <motion.span
              aria-hidden
              className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-md bg-background shadow-sm"
              animate={{ x: isSignIn ? 0 : "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
            <button
              type="button"
              role="tab"
              aria-selected={isSignIn}
              className={cn(
                "relative z-10 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isSignIn
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => switchMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isSignIn}
              className={cn(
                "relative z-10 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                !isSignIn
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => switchMode("signup")}
            >
              Create account
            </button>
          </div>

          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <label htmlFor="auth-email" className="sr-only">
                Email
              </label>
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldClass}
                placeholder="Email"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="auth-password" className="sr-only">
                Password
              </label>
              <input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={isSignIn ? "current-password" : "new-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldClass}
                placeholder="Password"
              />
            </div>

            <AnimatePresence initial={false}>
              {!isSignIn ? (
                <motion.div
                  key="confirm"
                  initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
                  transition={{ duration, ease }}
                  className="overflow-hidden"
                >
                  <div className="pb-1">
                    <label htmlFor="auth-confirm" className="sr-only">
                      Confirm password
                    </label>
                    <input
                      id="auth-confirm"
                      name="confirm"
                      type="password"
                      autoComplete="new-password"
                      required={!isSignIn}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className={fieldClass}
                      placeholder="Confirm password"
                    />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {error ? (
              <p className="text-sm text-rose-300" role="alert">
                {error}
              </p>
            ) : null}
            {signupNotice ? (
              <p className="text-sm text-teal-300/90" role="status">
                {signupNotice}{" "}
                <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={() => switchMode("signin")}
                >
                  Go to sign in
                </button>
              </p>
            ) : null}

            <Button
              type="submit"
              variant="default"
              size="lg"
              disabled={submitting}
              className="w-full gap-2 bg-white text-black hover:bg-white/90"
            >
              {submitting ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : null}
              {isSignIn
                ? submitting
                  ? "Signing in…"
                  : "Continue"
                : "Request account"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            By continuing, you agree to use TrustVault only with accounts you
            are authorised to hold.
          </p>
        </div>
      </div>
    </div>
  );
}
