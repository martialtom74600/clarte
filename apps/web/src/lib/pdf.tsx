import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { SimulationInput, SimulationResult } from "@separation/schemas";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 11 },
  title: { fontSize: 22, marginBottom: 8, fontWeight: "bold" },
  subtitle: { fontSize: 12, color: "#666", marginBottom: 24 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "bold", marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  disclaimer: { fontSize: 9, color: "#888", marginTop: 24, lineHeight: 1.4 },
  highlight: { fontSize: 18, fontWeight: "bold", color: "#0c8ce9", marginVertical: 8 },
});

function formatEuro(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function SimulationPdfDocument({
  simulation,
  result,
  email,
  proofId,
  generatedAt,
}: {
  simulation: SimulationInput;
  result: SimulationResult;
  email?: string;
  proofId?: string;
  generatedAt?: string;
}) {
  const timestamp = generatedAt ?? new Date().toISOString();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Rapport de simulation — Clarté</Text>
        <Text style={styles.subtitle}>
          Généré le {new Date(timestamp).toLocaleString("fr-FR")}
          {email ? ` • ${email}` : ""}
        </Text>
        {proofId && (
          <Text style={{ fontSize: 10, color: "#0c8ce9", marginBottom: 16 }}>
            Preuve d&apos;instant T — ID : {proofId}
          </Text>
        )}
        <Text style={{ fontSize: 9, color: "#666", marginBottom: 16 }}>
          Ce document fige une photographie financière à un instant donné. Il peut servir de base
          de travail en médiation ou devant un notaire.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Situation</Text>
          <Text>Statut : {simulation.status}</Text>
          {simulation.marriageRegime && (
            <Text>Régime : {simulation.marriageRegime}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patrimoine net estimé</Text>
          <View style={styles.row}>
            <Text>Personne A</Text>
            <Text>{formatEuro(result.netWorthByPerson.A.amount)}</Text>
          </View>
          <View style={styles.row}>
            <Text>Personne B</Text>
            <Text>{formatEuro(result.netWorthByPerson.B.amount)}</Text>
          </View>
        </View>

        {result.soulte && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Soulte estimée</Text>
            <Text style={styles.highlight}>
              {formatEuro(result.soulte.amount.amount)}
            </Text>
            <Text>
              {result.soulte.payer} verse à {result.soulte.receiver} pour{" "}
              {result.soulte.assetLabel}
            </Text>
            {result.soulte.totalCashNeeded && (
              <Text>
                Cash total (soulte + droit de partage + émoluments) :{" "}
                {formatEuro(result.soulte.totalCashNeeded.amount)}
              </Text>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scénarios comparés</Text>
          {result.scenarios.map((s) => (
            <View key={s.scenario} style={{ marginBottom: 8 }}>
              <Text style={{ fontWeight: "bold" }}>{s.label}</Text>
              <Text>
                A : {formatEuro(s.netWorthByPerson.A.amount)} • B :{" "}
                {formatEuro(s.netWorthByPerson.B.amount)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Complexité : {result.complexityScore}/100</Text>
        </View>

        {result.warnings.map((w) => (
          <Text key={w.code} style={{ fontSize: 10, marginBottom: 4 }}>
            ⚠ {w.message}
          </Text>
        ))}

        <View style={styles.disclaimer}>
          {result.disclaimers.map((d, i) => (
            <Text key={i}>{d}</Text>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export async function generateSimulationPdf(
  simulation: SimulationInput,
  result: SimulationResult,
  email?: string,
  proofId?: string
): Promise<Buffer> {
  const generatedAt = new Date().toISOString();
  const doc = (
    <SimulationPdfDocument
      simulation={simulation}
      result={result}
      email={email}
      proofId={proofId}
      generatedAt={generatedAt}
    />
  );
  const blob = await pdf(doc).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
