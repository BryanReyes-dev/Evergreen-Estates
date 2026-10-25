"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

type LoadingStateProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
  className?: string;
};

const logoClasses = {
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-16 w-16",
} satisfies Record<NonNullable<LoadingStateProps["size"]>, string>;

const logoPixels = {
  sm: 36,
  md: 48,
  lg: 64,
} satisfies Record<NonNullable<LoadingStateProps["size"]>, number>;

/** A shared loading indicator that uses the Evergreen Estates logo. */
export function LoadingState({
  label = "Loading…",
  size = "md",
  fullScreen = false,
  className = "",
}: LoadingStateProps) {
  const prefersReducedMotion = useReducedMotion();
  const imagePixels = logoPixels[size];

  return (
    <div
      aria-busy="true"
      className={`flex w-full flex-col items-center justify-center gap-3 px-4 py-8 text-center ${
        fullScreen ? "min-h-[60vh]" : "min-h-32"
      } ${className}`}
    >
      <motion.div
        aria-hidden="true"
        className={logoClasses[size]}
        animate={{ rotate: prefersReducedMotion ? 0 : 360 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.12 }
            : { duration: 1.35, ease: "linear", repeat: Infinity }
        }
      >
        <Image
          src="/images/logo/evergreen_logo.png"
          alt=""
          width={imagePixels}
          height={imagePixels}
          sizes={`${imagePixels}px`}
          className="h-full w-full object-contain"
        />
      </motion.div>
      <output aria-live="polite" className="text-sm text-white/70">{label}</output>
    </div>
  );
}
