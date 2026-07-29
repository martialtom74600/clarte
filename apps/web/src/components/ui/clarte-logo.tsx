import { cn } from "@/lib/utils";

interface ClarteLogoProps {
  size?: "sm" | "md";
  variant?: "light" | "dark";
  label?: string;
  className?: string;
}

export function ClarteLogo({
  size = "md",
  variant = "dark",
  label = "Clarté",
  className,
}: ClarteLogoProps) {
  const boxSize = size === "sm" ? "h-8 w-8 text-sm rounded-lg" : "h-9 w-9 text-base rounded-xl";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex items-center justify-center bg-brand-600 font-bold text-white shadow-md shadow-brand-600/20",
          boxSize
        )}
      >
        C
      </div>
      <span
        className={cn(
          "font-semibold tracking-tight",
          size === "md" ? "text-xl" : "text-base",
          variant === "light" ? "text-white" : "text-slate-900"
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function ClarteLogoPro({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white shadow-lg shadow-brand-500/20">
        C
      </div>
      <span className="font-semibold text-white">Clarté Pro</span>
    </div>
  );
}
