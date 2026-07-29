import { Shield, Lock, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { clarteGlassCard } from "@/lib/clarte-design";

const items = [
  { icon: Shield, text: "Données chiffrées · RGPD" },
  { icon: Lock, text: "Jamais partagé sans votre accord" },
  { icon: FileCheck, text: "Simulation indicative certifiée" },
];

export function TrustStrip({ variant = "default" }: { variant?: "default" | "compact" }) {
  if (variant === "compact") {
    return (
      <div className="flex flex-wrap justify-center gap-4">
        {items.map(({ icon: Icon, text }) => (
          <span
            key={text}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800/90"
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {text}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        clarteGlassCard,
        "border-emerald-200/60 bg-emerald-50/50 px-4 py-3 backdrop-blur-sm"
      )}
    >
      <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center md:justify-start">
        {items.map(({ icon: Icon, text }) => (
          <span
            key={text}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800/90"
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
