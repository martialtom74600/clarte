import { SimulationWizard } from "@/components/wizard/simulation-wizard";

export const metadata = {
  title: "Simulation — Clarté",
  description: "Simulez votre répartition patrimoniale en quelques minutes.",
};

export default function SimulationPage() {
  return <SimulationWizard />;
}
