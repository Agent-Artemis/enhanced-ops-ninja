import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type AssessmentReportPdfInput = {
  title: string;
  trackLabel: string;
  tierLabel: string;
  overallScore: number;
  domainLines: { name: string; score: number }[];
  generatedAtIso: string;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#111111",
  },
  brand: {
    fontSize: 22,
    marginBottom: 8,
    color: "#1a6ecc",
    fontFamily: "Helvetica-Bold",
  },
  h1: {
    fontSize: 18,
    marginBottom: 12,
    fontFamily: "Helvetica-Bold",
  },
  meta: {
    fontSize: 10,
    color: "#444444",
    marginBottom: 16,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#dddddd",
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#666666",
  },
});

export function AssessmentReportDocument(props: AssessmentReportPdfInput) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.brand}>Enhanced Ops × Ninja</Text>
        <Text style={styles.h1}>{props.title}</Text>
        <Text style={styles.meta}>
          Track: {props.trackLabel} · Tier: {props.tierLabel} · Generated:{" "}
          {props.generatedAtIso}
        </Text>
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 6 }}>
            Overall operational health
          </Text>
          <Text style={{ fontSize: 28, color: "#1a6ecc" }}>{props.overallScore}</Text>
          <Text style={{ fontSize: 10, color: "#444444" }}>Score out of 100</Text>
        </View>
        <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 8 }}>
          Domain breakdown
        </Text>
        {props.domainLines.map((d) => (
          <View key={d.name} style={styles.scoreRow} wrap={false}>
            <Text>{d.name}</Text>
            <Text>{d.score}</Text>
          </View>
        ))}
        <Text style={styles.footer}>
          Confidential — prepared for the recipient. Enhanced Ops assessments measure operational
          maturity; they are not clinical, legal, or financial advice.
        </Text>
      </Page>
    </Document>
  );
}
