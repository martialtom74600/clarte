/**
 * Clarté Design System — tokens sémantiques partagés B2C + B2B.
 * Importer `clarte` pour les classes CSS, `clarteToast` pour Sonner.
 */

export const clarte = {
  /** Fond mesh (pages app, wizard, dashboard) */
  mesh: "clarte-mesh",
  /** Fond sombre (login auth) */
  surfaceDark: "clarte-surface-dark",
  /** Hero marketing */
  hero: "clarte-hero",
  /** Carte glass */
  glass: "clarte-glass",
  /** Header app public (clair) */
  headerLight: "clarte-glass-header-light",
  /** Header espace pro (sombre) */
  headerDark: "clarte-glass-header-dark",
  /** CTA principal */
  btnPrimary: "clarte-btn-primary",
  /** Bouton secondaire */
  btnGhost: "clarte-btn-ghost",
  /** Input standard */
  input: "clarte-input",
  /** Hover carte */
  cardHover: "clarte-card-hover",
  /** Badge lead hot */
  hotPulse: "clarte-hot-pulse",
  /** Skeleton loading */
  shimmer: "clarte-shimmer",
  /** Rayons */
  radiusSm: "rounded-xl",
  radiusMd: "rounded-2xl",
  radiusLg: "rounded-3xl",
  /** Conteneur page standard */
  container: "mx-auto max-w-6xl px-4",
  containerNarrow: "mx-auto max-w-3xl px-4",
} as const;

export const clarteToast = {
  position: "bottom-center" as const,
  closeButton: true,
  richColors: true,
  toastOptions: {
    classNames: {
      toast:
        "bg-white/95 backdrop-blur-md border border-slate-200 shadow-[0_4px_24px_rgba(0,0,0,0.08)]",
      title: "text-sm font-medium text-slate-900",
      description: "text-xs text-slate-500",
      actionButton: "bg-brand-600 text-white text-xs rounded-full px-3",
    },
  },
};

/** Focus ring inline (Framer Motion inputs) */
export const clarteFocusRing =
  "focus:border-brand-400 focus:shadow-[0_0_0_3px_rgba(0,111,199,0.2)]";

/** Carte glass + radius standard */
export const clarteGlassCard = `${clarte.glass} ${clarte.radiusMd}`;

/** Shell wizard / formulaire premium */
export const clarteWizardShell = `${clarteGlassCard} ${clarte.radiusLg} p-6 md:p-10 shadow-[0_8px_40px_rgba(0,0,0,0.06)]`;
