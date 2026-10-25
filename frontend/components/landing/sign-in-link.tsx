"use client";

import {
  forwardRef,
  type ReactNode,
  type MouseEvent,
  type ButtonHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";
import type { AuthMode } from "@/components/ui/login-03";

type SignInLinkProps = {
  mode?: AuthMode;
  className?: string;
  children: ReactNode;
  onOpenAuth?: (mode: AuthMode) => void;
  onNavigate?: () => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">;

/**
 * Opens the auth popup (no page navigation).
 */
export const SignInLink = forwardRef<HTMLButtonElement, SignInLinkProps>(
  function SignInLink(
    {
      mode = "signin",
      className,
      children,
      onOpenAuth,
      onNavigate,
      onClick: onClickProp,
      ...rest
    },
    ref,
  ) {
    function onClick(event: MouseEvent<HTMLButtonElement>) {
      onClickProp?.(event);
      if (event.defaultPrevented) return;
      onNavigate?.();
      onOpenAuth?.(mode);
    }

    return (
      <button
        ref={ref}
        type="button"
        className={cn(className)}
        onClick={onClick}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
