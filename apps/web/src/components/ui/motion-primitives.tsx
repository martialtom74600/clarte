"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { clarte, clarteGlassCard } from "@/lib/clarte-design";
import { duration, ease, spring, staggerContainer, staggerItem } from "@/lib/motion";

export function MotionCard({
  children,
  className,
  layoutId,
}: {
  children: React.ReactNode;
  className?: string;
  layoutId?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      layoutId={layoutId}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: duration.fast } : spring.soft}
      className={cn(clarteGlassCard, className)}
    >
      {children}
    </motion.div>
  );
}

export function StaggerList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      variants={reduced ? undefined : staggerContainer}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div variants={reduced ? undefined : staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

export function DrawCheck({ className }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("h-5 w-5 text-emerald-500", className)}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring.snappy}
    >
      <motion.path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: duration.slow, ease: ease.out }}
      />
    </motion.svg>
  );
}

export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.normal, ease: ease.out, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        clarte.shimmer,
        "rounded-xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 bg-[length:200%_100%]",
        className
      )}
    />
  );
}
