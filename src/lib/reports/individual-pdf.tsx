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
  page: { padding: 26, fontSize: 7.5, color: COLOR.text, fontFamily: "Helvetica" },
  eyebrow: {
    fontSize: 6,
    letterSpacing: 1.2,
    color: COLOR.accent,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  name: { fontSize: 15, marginTop: 4, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 7.5, color: COLOR.muted, marginTop: 3 },
  headlineBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: 5,
    padding: 9,
  },
  headlineLabel: {
    fontSize: 6,
    letterSpacing: 1.2,
    color: COLOR.muted,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  headlineValue: { fontSize: 19, marginTop: 3, fontFamily: "Helvetica-Bold" },
  note: { fontSize: 6.3, color: COLOR.muted, marginTop: 5, lineHeight: 1.35 },
  section: { marginTop: 10 },
  sectionTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  stat: {
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: 3,
    padding: 5,
    minWidth: 82,
    flexGrow: 1,
  },
  statLabel: {
    fontSize: 5.4,
    letterSpacing: 1,
    color: COLOR.muted,
    textTransform: "uppercase",
  },
  statValue: { fontSize: 9.5, marginTop: 2, fontFamily: "Helvetica-Bold" },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    paddingBottom: 3,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.border,
    paddingVertical: 2.5,
  },
  cellHead: { fontSize: 5.8, color: COLOR.muted, textTransform: "uppercase" },
  cell: { fontSize: 7 },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 26,
    right: 26,
    fontSize: 6,
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
        {data.subtitle ? (
          <Text style={styles.subtitle}>{data.subtitle}</Text>
        ) : null}

        <View style={styles.headlineBox}>
          <Text style={styles.headlineLabel}>{data.headline.label}</Text>
          <Text
            style={[styles.headlineValue, { color: toneColor(data.headline.tone) }]}
          >
            {data.headline.value}
          </Text>
          <View style={{ marginTop: 7 }}>
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
