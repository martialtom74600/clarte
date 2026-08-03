import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { AffordabilityVerdict } from "@separation/schemas";
import type { ExpertExportPack, ExportDoorChapter } from "@/lib/separation/export-bilan-model";
import { groupLedgerLines, resolveLedgerSectionMeta } from "@/lib/separation/lab-ledger-sections";
import { formatEuro } from "@/lib/utils";

const BRAND = "#006FC7";
const INK = "#0f172a";
const MUTED = "#64748b";
const RULE = "#e2e8f0";
const SOFT = "#f8fafc";

/** Largeur utile A4 avec marges 40 — les % s'appliquent aux View, jamais aux Text. */
const styles = StyleSheet.create({
  page: {
    paddingTop: 52,
    paddingBottom: 64,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: INK,
  },
  header: {
    position: "absolute",
    top: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: MUTED,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: MUTED,
  },
  coverBrand: {
    fontSize: 11,
    letterSpacing: 2,
    color: BRAND,
    marginBottom: 24,
    textTransform: "uppercase",
  },
  coverTitle: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.3,
    marginBottom: 10,
  },
  coverSub: {
    fontSize: 11,
    color: MUTED,
    marginBottom: 6,
    lineHeight: 1.4,
  },
  coverDate: {
    fontSize: 10,
    color: MUTED,
    marginBottom: 20,
  },
  coverBox: {
    marginTop: 20,
    padding: 14,
    backgroundColor: SOFT,
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
  },
  coverBoxText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: "#334155",
  },
  h1: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    color: INK,
  },
  h2: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    marginTop: 14,
    color: INK,
  },
  h3: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
    color: "#1e293b",
  },
  body: {
    fontSize: 9.5,
    lineHeight: 1.45,
    color: "#334155",
    marginBottom: 6,
  },
  muted: {
    fontSize: 9,
    color: MUTED,
    lineHeight: 1.4,
  },
  kvRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
  },
  kvLabel: {
    width: "42%",
    paddingRight: 8,
  },
  kvValue: {
    width: "58%",
  },
  kvLabelText: {
    fontSize: 9,
    color: MUTED,
    lineHeight: 1.35,
  },
  kvValueText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    lineHeight: 1.35,
  },
  doorCard: {
    marginBottom: 8,
    padding: 10,
    backgroundColor: SOFT,
    borderRadius: 2,
  },
  doorCardTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    color: INK,
  },
  doorMetaRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  doorMetaLabel: {
    width: "28%",
    paddingRight: 6,
  },
  doorMetaValue: {
    width: "72%",
  },
  doorMetaLabelText: {
    fontSize: 8,
    color: MUTED,
    lineHeight: 1.35,
  },
  doorMetaValueText: {
    fontSize: 8.5,
    color: "#334155",
    lineHeight: 1.35,
  },
  verdictBanner: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  verdictGreen: { backgroundColor: "#ecfdf5" },
  verdictOrange: { backgroundColor: "#fffbeb" },
  verdictRed: { backgroundColor: "#fef2f2" },
  verdictLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  verdictHeadline: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    lineHeight: 1.35,
  },
  sectionBlock: {
    marginTop: 8,
    marginBottom: 4,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: BRAND,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 8,
    color: MUTED,
    marginBottom: 6,
    lineHeight: 1.35,
  },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 3.5,
  },
  ledgerLabel: {
    width: "70%",
    paddingRight: 10,
  },
  ledgerAmount: {
    width: "30%",
  },
  ledgerLabelText: {
    fontSize: 9,
    color: "#334155",
    lineHeight: 1.35,
  },
  ledgerHint: {
    fontSize: 7.5,
    color: MUTED,
    marginTop: 1,
    lineHeight: 1.3,
  },
  ledgerAmountText: {
    fontSize: 9,
    textAlign: "right",
    lineHeight: 1.35,
  },
  subtract: { color: "#b91c1c" },
  total: { fontFamily: "Helvetica-Bold", color: INK },
  highlight: { fontFamily: "Helvetica-Bold", color: BRAND },
  insightBlock: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: SOFT,
  },
  nextStep: {
    fontSize: 9,
    lineHeight: 1.4,
    marginBottom: 4,
    color: "#334155",
  },
  disclaimer: {
    fontSize: 8,
    color: MUTED,
    lineHeight: 1.45,
    marginTop: 12,
  },
});

function verdictStyle(level: AffordabilityVerdict) {
  if (level === "green") return styles.verdictGreen;
  if (level === "red") return styles.verdictRed;
  return styles.verdictOrange;
}

function verdictColor(level: AffordabilityVerdict) {
  if (level === "green") return "#047857";
  if (level === "red") return "#b91c1c";
  return "#b45309";
}

function PageChrome({ dateLabel }: { dateLabel: string }) {
  return (
    <>
      <View style={styles.header} fixed>
        <Text>Clarté — Bilan de séparation</Text>
        <Text>{dateLabel}</Text>
      </View>
      <View style={styles.footer} fixed>
        <Text>Simulation indicative — ne remplace pas un conseil notarial</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </>
  );
}

function FieldRows({
  fields,
}: {
  fields: { label: string; value: string }[];
}) {
  return (
    <View>
      {fields.map((f) => (
        <View key={f.label} style={styles.kvRow} wrap={false}>
          <View style={styles.kvLabel}>
            <Text style={styles.kvLabelText}>{f.label}</Text>
          </View>
          <View style={styles.kvValue}>
            <Text style={styles.kvValueText}>{f.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function CoverPage({ pack }: { pack: ExpertExportPack }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.coverBrand}>Clarté</Text>
      <Text style={styles.coverTitle}>Bilan de séparation{"\n"}immobilière</Text>
      <Text style={styles.coverSub}>{pack.coverSubtitle}</Text>
      <Text style={styles.coverDate}>Généré le {pack.dateLabel}</Text>
      {pack.email ? <Text style={styles.muted}>{pack.email}</Text> : null}
      {pack.proofId ? (
        <Text style={{ fontSize: 9, color: BRAND, marginTop: 6 }}>
          Preuve d'instant T — {pack.proofId}
        </Text>
      ) : null}
      <View style={styles.coverBox}>
        <Text style={styles.coverBoxText}>
          Ce document compare les cinq façons de sortir du logement à deux : vous le
          gardez, l'autre le garde, vous vendez pour racheter, vous vendez pour louer,
          ou vous gardez et louez. Chaque chapitre dit la même chose en clair — ce qui
          se passe, combien ça coûte, et quoi faire ensuite — pour en parler sereinement
          avec un notaire ou un conseiller.
        </Text>
      </View>
      <Text style={[styles.disclaimer, { marginTop: 36 }]}>{pack.disclaimer}</Text>
    </Page>
  );
}

function MatrixDoorCard({
  row,
}: {
  row: ExpertExportPack["matrix"][number];
}) {
  const meta: { label: string; value: string; color?: string }[] = [
    { label: "Verdict", value: row.verdictLabel, color: verdictColor(row.verdictLevel) },
    { label: "Argent", value: row.cashLabel },
    { label: "Chaque mois", value: row.monthlyLabel },
    { label: "Se reloger", value: row.relocateLabel },
  ];

  return (
    <View style={styles.doorCard} wrap={false}>
      <Text style={styles.doorCardTitle}>{row.title}</Text>
      {meta.map((m) => (
        <View key={m.label} style={styles.doorMetaRow}>
          <View style={styles.doorMetaLabel}>
            <Text style={styles.doorMetaLabelText}>{m.label}</Text>
          </View>
          <View style={styles.doorMetaValue}>
            <Text
              style={[
                styles.doorMetaValueText,
                m.color ? { color: m.color, fontFamily: "Helvetica-Bold" } : {},
              ]}
            >
              {m.value}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function AssumptionsPage({ pack }: { pack: ExpertExportPack }) {
  return (
    <Page size="A4" style={styles.page} wrap>
      <PageChrome dateLabel={pack.dateLabel} />
      <Text style={styles.h1}>Ce qu'on a pris comme base</Text>
      <Text style={styles.body}>
        Voici la situation figée à la date du document. Si vous avez ajusté des curseurs
        dans le laboratoire, ils s'appliquent à toutes les portes.
      </Text>
      <Text style={styles.h2}>Votre situation</Text>
      <FieldRows fields={pack.footprint} />
      <Text style={styles.h2}>Ce que vous avez ajusté</Text>
      {pack.activeLevers.length === 0 ? (
        <Text style={styles.muted}>Rien de particulier — on part des hypothèses standard.</Text>
      ) : (
        <FieldRows
          fields={pack.activeLevers.map((l) => ({ label: l.label, value: l.value }))}
        />
      )}
    </Page>
  );
}

function MatrixPage({ pack }: { pack: ExpertExportPack }) {
  return (
    <Page size="A4" style={styles.page} wrap>
      <PageChrome dateLabel={pack.dateLabel} />
      <Text style={styles.h1}>Les cinq options en un coup d'œil</Text>
      <Text style={[styles.body, { marginBottom: 10 }]}>
        Une vue rapide pour comparer. Le détail et les prochaines étapes sont dans
        chaque chapitre.
      </Text>
      {pack.matrix.map((row) => (
        <MatrixDoorCard key={row.doorId} row={row} />
      ))}
    </Page>
  );
}

function LedgerSection({
  sectionId,
  lines,
  doorId,
}: {
  sectionId: Parameters<typeof resolveLedgerSectionMeta>[0];
  lines: ExportDoorChapter["bilan"]["ledger"]["lines"];
  doorId: ExportDoorChapter["doorId"];
}) {
  const meta = resolveLedgerSectionMeta(sectionId, doorId);
  return (
    <View style={styles.sectionBlock}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{meta.title}</Text>
        <Text style={styles.sectionSub}>{meta.subtitle}</Text>
      </View>
      {lines.map((line) => (
        <View key={line.id} style={styles.ledgerRow} wrap={false}>
          <View style={styles.ledgerLabel}>
            <Text style={styles.ledgerLabelText}>{line.label}</Text>
            {line.hint ? <Text style={styles.ledgerHint}>{line.hint}</Text> : null}
          </View>
          <View style={styles.ledgerAmount}>
            <Text
              style={[
                styles.ledgerAmountText,
                ...(line.tone === "subtract" ? [styles.subtract] : []),
                ...(line.tone === "total" ? [styles.total] : []),
                ...(line.tone === "highlight" ? [styles.highlight] : []),
              ]}
            >
              {line.tone === "subtract" ? "− " : ""}
              {formatEuro(Math.abs(line.amount))}
              {line.suffix ?? ""}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ChapterPages({
  chapter,
  pack,
}: {
  chapter: ExportDoorChapter;
  pack: ExpertExportPack;
}) {
  const groups = groupLedgerLines(chapter.bilan.ledger.lines);
  const v = chapter.verdict;

  return (
    <Page size="A4" style={styles.page} wrap>
      <PageChrome dateLabel={pack.dateLabel} />
      <Text style={styles.h1}>{chapter.title}</Text>

      {v ? (
        <View style={[styles.verdictBanner, verdictStyle(v.level)]} wrap={false}>
          <Text style={[styles.verdictLabel, { color: verdictColor(v.level) }]}>
            {v.label}
          </Text>
          <Text style={styles.verdictHeadline}>{v.headline}</Text>
          <Text style={styles.body}>{v.detail}</Text>
        </View>
      ) : null}

      <Text style={styles.h2}>Comment ça marche</Text>
      {chapter.howItWorks.map((block) => (
        <View key={block.title} style={{ marginBottom: 8 }} wrap={false}>
          <Text style={styles.h3}>{block.title}</Text>
          <Text style={styles.body}>{block.body}</Text>
        </View>
      ))}

      <Text style={styles.h2}>Les chiffres, en détail</Text>
      {groups.map((group) => (
        <LedgerSection
          key={group.sectionId}
          sectionId={group.sectionId}
          lines={group.lines}
          doorId={chapter.bilan.ledger.sectionVoiceDoorId ?? chapter.doorId}
        />
      ))}

      {chapter.bilan.insights.length > 0 ? (
        <>
          <Text style={styles.h2}>Points d'attention</Text>
          {chapter.bilan.insights.map((insight) => (
            <View key={insight.title} style={styles.insightBlock} wrap={false}>
              <Text style={styles.h3}>{insight.title}</Text>
              <Text style={styles.body}>{insight.body}</Text>
            </View>
          ))}
        </>
      ) : null}

      <Text style={styles.h2}>Et ensuite</Text>
      {chapter.nextSteps.map((step, i) => (
        <Text key={i} style={styles.nextStep} wrap={false}>
          {i + 1}. {step}
        </Text>
      ))}

      {chapter.bilan.ledger.contextNote || chapter.bilan.ledger.warningNote ? (
        <View style={[styles.coverBox, { marginTop: 14 }]} wrap={false}>
          {chapter.bilan.ledger.contextNote ? (
            <Text style={styles.coverBoxText}>{chapter.bilan.ledger.contextNote}</Text>
          ) : null}
          {chapter.bilan.ledger.warningNote ? (
            <Text style={[styles.coverBoxText, { marginTop: 6 }]}>
              {chapter.bilan.ledger.warningNote}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Page>
  );
}

function AnnexPage({ pack }: { pack: ExpertExportPack }) {
  return (
    <Page size="A4" style={styles.page}>
      <PageChrome dateLabel={pack.dateLabel} />
      <Text style={styles.h1}>Annexe — ce que Clarté ne fait pas</Text>
      <Text style={styles.body}>
        Clarté prend une photo de votre situation financière à un instant donné. Les
        montants aident à discuter — ce n'est ni un acte chez le notaire, ni une promesse
        de la banque.
      </Text>
      <Text style={styles.h2}>Ce qu'on calcule</Text>
      <Text style={styles.body}>
        Vos parts, les apports (créance 815-13 ou récompense 1469), le crédit restant,
        les frais de vente, une plus-value indicative, le résultat d'une location, et des
        cibles de relogement basées sur les prix / loyers de votre zone.
      </Text>
      <Text style={styles.h2}>Ce qu'il faudra valider ailleurs</Text>
      <Text style={styles.body}>
        L'accord de la banque, une vraie estimation du bien, le détail de votre régime
        matrimonial, une prestation compensatoire définitive, et le conseil personnalisé
        d'un notaire ou d'un avocat.
      </Text>
      <Text style={styles.disclaimer}>{pack.disclaimer}</Text>
    </Page>
  );
}

export function ExpertBilanPdfDocument({ pack }: { pack: ExpertExportPack }) {
  return (
    <Document
      title="Bilan de séparation — Clarté"
      author="Clarté"
      subject={pack.coverSubtitle}
    >
      <CoverPage pack={pack} />
      <AssumptionsPage pack={pack} />
      <MatrixPage pack={pack} />
      {pack.chapters.map((chapter) => (
        <ChapterPages key={chapter.doorId} chapter={chapter} pack={pack} />
      ))}
      <AnnexPage pack={pack} />
    </Document>
  );
}

export async function generateExpertBilanPdf(pack: ExpertExportPack): Promise<Buffer> {
  const blob = await pdf(<ExpertBilanPdfDocument pack={pack} />).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
