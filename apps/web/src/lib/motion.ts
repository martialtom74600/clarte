export const ease = {
  out: [0.16, 1, 0.3, 1] as [number, number, number, number],
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
};

export const spring = {
  default: { type: "spring" as const, stiffness: 380, damping: 32 },
  soft: { type: "spring" as const, stiffness: 260, damping: 28 },
  snappy: { type: "spring" as const, stiffness: 520, damping: 38 },
};

export const duration = {
  instant: 0.12,
  fast: 0.2,
  normal: 0.32,
  slow: 0.48,
  dramatic: 0.68,
};

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.normal, ease: ease.out },
  },
};

export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.08 },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: spring.soft,
  },
};

export const scaleTap = {
  whileHover: { scale: 1.008, y: -1 },
  whileTap: { scale: 0.992 },
  transition: spring.snappy,
};
