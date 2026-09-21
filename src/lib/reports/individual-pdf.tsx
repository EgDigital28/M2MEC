import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

/**
 * A real PDF, not a screenshot of the page: text stays selectable and the
 * renderer paginates properly. Only presentation is restated here — every
 * figure still comes from the shared Fin loader, so the numbers cannot drift
 * from the on-screen report.
 */

export type IndividualPdfStat = { label: string; value: string; tone?: Tone };
export type Tone = "neutral" | "positive" | "negative" | "warning";

export type IndividualPdfSection =
  | { kind: "stats"; title: string; stats: IndividualPdfStat[]; note?: string }
  | {
      kind: "table";
      title: string;
      columns: { label: string; align?: "left" | "right" }[];
      rows: { cells: string[]; tones?: (Tone | undefined)[] }[];
      note?: string;
    };

export type IndividualPdfData = {
  name: string;
  subtitle: string;
  generatedOn: string;
  headline: { label: string; value: string; tone: Tone };
  headlineStats: IndividualPdfStat[];
  headlineNotes: string[];
  sections: IndividualPdfSection[];
};

const COLOR = {
  text: "#111111",
  muted: "#555555",
  border: "#d4d4d8",
  positive: "#047857",
  negative: "#b91c1c",
  warning: "#b45309",
  accent: "#1d4ed8",
};

function toneColor(tone: Tone = "neutral") {
  if (tone === "positive") return COLOR.positive;
  if (tone === "negative") return COLOR.negative;
  if (tone === "warning") return COLOR.warning;
  return COLOR.text;
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: COLOR.text, fontFamily: "Helvetica" },
  eyebrow: {
    fontSize: 7,
    letterSpacing: 1.2,
    color: COLOR.accent,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  name: { fontSize: 20, marginTop: 6, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 9, color: COLOR.muted, marginTop: 4 },
  headlineBox: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: 6,
    padding: 12,
  },
  headlineLabel: {
    fontSize: 7,
    letterSpacing: 1.2,
    color: COLOR.muted,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  headlineValue: { fontSize: 26, marginTop: 4, fontFamily: "Helvetica-Bold" },
  note: { fontSize: 8, color: COLOR.muted, marginTop: 8, lineHeight: 1.4 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stat: {
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: 4,
    padding: 8,
    minWidth: 104,
    flexGrow: 1,
  },
  statLabel: {
    fontSize: 6.5,
    letterSpacing: 1,
    color: COLOR.muted,
    textTransform: "uppercase",
  },
  statValue: { fontSize: 12, marginTop: 3, fontFamily: "Helvetica-Bold" },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    paddingBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.border,
    paddingVertical: 4,
  },
  cellHead: { fontSize: 7, color: COLOR.muted, textTransform: "uppercase" },
  cell: { fontSize: 8.5 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 7,
    color: COLOR.muted,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function Stats({ stats }: { stats: IndividualPdfStat[] }) {
  return (
    <View style={styles.statRow}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.stat}>
          <Text style={styles.statLabel}>{stat.label}</Text>
          <Text style={[styles.statValue, { color: toneColor(stat.tone) }]}>
            {stat.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function IndividualPdf({ data }: { data: IndividualPdfData }) {
  return (
    <Document
      title={`${data.name} — M2MEC individual summary`}
      author="M2MEC"
    >
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.eyebrow}>Individual summary</Text>
        <Text style={styles.name}>{data.name}</Text>
        <Text style={styles.subtitle}>{data.subtitle}</Text>

        <View style={styles.headlineBox}>
          <Text style={styles.headlineLabel}>{data.headline.label}</Text>
          <Text
            style={[styles.headlineValue, { color: toneColor(data.headline.tone) }]}
          >
            {data.headline.value}
          </Text>
          <View style={{ marginTop: 10 }}>
            <Stats stats={data.headlineStats} />
          </View>
          {data.headlineNotes.map((note) => (
            <Text key={note} style={styles.note}>
              {note}
            </Text>
          ))}
        </View>

        {data.sections.map((section) => (
          <View key={section.title} style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{section.title}</Text>

            {section.kind === "stats" ? (
              <Stats stats={section.stats} />
            ) : (
              <View>
                <View style={styles.tableHeader}>
                  {section.columns.map((column) => (
                    <Text
                      key={column.label}
                      style={[
                        styles.cellHead,
                        {
                          flex: 1,
                          textAlign: column.align === "right" ? "right" : "left",
                        },
                      ]}
                    >
                      {column.label}
                    </Text>
                  ))}
                </View>
                {section.rows.map((row, index) => (
                  <View key={index} style={styles.tableRow}>
                    {row.cells.map((cell, cellIndex) => (
                      <Text
                        key={cellIndex}
                        style={[
                          styles.cell,
                          {
                            flex: 1,
                            textAlign:
                              section.columns[cellIndex]?.align === "right"
                                ? "right"
                                : "left",
                            color: toneColor(row.tones?.[cellIndex]),
                          },
                        ]}
                      >
                        {cell}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            )}

            {section.note ? <Text style={styles.note}>{section.note}</Text> : null}
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>M2MEC · generated {data.generatedOn}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
