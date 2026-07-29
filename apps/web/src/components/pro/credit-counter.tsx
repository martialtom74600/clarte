"use client";

import { useEffect, useRef } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

export function CreditCounter({
  balance,
  className,
  linkToCredits = true,
}: {
  balance: number;
  className?: string;
  linkToCredits?: boolean;
}) {
  const spring = useSpring(balance, { stiffness: 380, damping: 32 });
  const display = useTransform(spring, (v) => Math.round(v).toString());
  const prev = useRef(balance);

  useEffect(() => {
    if (prev.current !== balance) {
      spring.set(balance);
      prev.current = balance;
    }
  }, [balance, spring]);

  const content = (
    <motion.div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm",
        linkToCredits && "hover:bg-white/15 transition-colors",
        className
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Coins className="h-4 w-4 text-brand-300" />
      <motion.span>{display}</motion.span>
      <span className="text-slate-400">crédits</span>
    </motion.div>
  );

  if (linkToCredits) {
    return <Link href="/pro/credits">{content}</Link>;
  }
  return content;
}
