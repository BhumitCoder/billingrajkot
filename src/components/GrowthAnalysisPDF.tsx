import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { ReportLanguage } from "./AIAgent";

// ─────────────────────────────────────────────────────────────────────────────
// FONT SETUP
//
// @react-pdf/renderer ONLY supports TTF / OTF — NOT woff / woff2.
// We use Noto Sans fonts served as raw TTF from the notofonts GitHub releases.
// These URLs are stable and publicly accessible without CORS issues.
// ─────────────────────────────────────────────────────────────────────────────

// Latin / English — Noto Sans
Font.register({
  family: "NotoSans",
  fonts: [
    {
      src: "https://raw.githack.com/notofonts/notofonts.github.io/main/fonts/NotoSans/hinted/ttf/NotoSans-Regular.ttf",
      fontWeight: "normal",
    },
    {
      src: "https://raw.githack.com/notofonts/notofonts.github.io/main/fonts/NotoSans/hinted/ttf/NotoSans-Bold.ttf",
      fontWeight: "bold",
    },
  ],
});

// Hindi — Noto Sans Devanagari
Font.register({
  family: "NotoDevanagari",
  fonts: [
    {
      src: "https://raw.githack.com/notofonts/notofonts.github.io/main/fonts/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Regular.ttf",
      fontWeight: "normal",
    },
    {
      src: "https://raw.githack.com/notofonts/notofonts.github.io/main/fonts/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Bold.ttf",
      fontWeight: "bold",
    },
  ],
});

// Gujarati — Noto Sans Gujarati
Font.register({
  family: "NotoGujarati",
  fonts: [
    {
      src: "https://raw.githack.com/notofonts/notofonts.github.io/main/fonts/NotoSansGujarati/hinted/ttf/NotoSansGujarati-Regular.ttf",
      fontWeight: "normal",
    },
    {
      src: "https://raw.githack.com/notofonts/notofonts.github.io/main/fonts/NotoSansGujarati/hinted/ttf/NotoSansGujarati-Bold.ttf",
      fontWeight: "bold",
    },
  ],
});

// Hyphenation callback — prevents aggressive word-breaking
Font.registerHyphenationCallback((word) => [word]);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getBodyFont(lang: ReportLanguage): string {
  if (lang === "hindi")    return "NotoDevanagari";
  if (lang === "gujarati") return "NotoGujarati";
  return "NotoSans";
}

/** Replace rupee symbols — built-in fonts can't render ₹ */
const sanitize = (t: string) =>
  (t || "").replace(/₹/g, "Rs.").replace(/\u20B9/g, "Rs.");

// ─────────────────────────────────────────────────────────────────────────────
// STYLES (generated per language so font family is baked in)
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(lang: ReportLanguage) {
  const body = getBodyFont(lang);

  return StyleSheet.create({
    page: {
      backgroundColor: "#ffffff",
      paddingBottom: 55,
      fontFamily: body,
    },

    // ── Cover ──────────────────────────────────────────────────
    coverBand: {
      backgroundColor: "#0f172a",
      paddingHorizontal: 48,
      paddingTop: 36,
      paddingBottom: 26,
    },
    accentBar: {
      width: 36,
      height: 3,
      backgroundColor: "#3b82f6",
      borderRadius: 2,
      marginBottom: 14,
    },
    companyName: {
      fontFamily: body,
      fontWeight: "bold",
      fontSize: 21,
      color: "#f8fafc",
      marginBottom: 5,
    },
    reportTitle: {
      fontFamily: body,
      fontWeight: "bold",
      fontSize: 12,
      color: "#93c5fd",
      marginBottom: 4,
    },
    reportMeta: {
      fontFamily: "NotoSans",   // always Latin for date/meta
      fontSize: 8,
      color: "#64748b",
    },

    // ── Body ───────────────────────────────────────────────────
    body: {
      paddingHorizontal: 48,
      paddingTop: 24,
    },

    // ── Section ────────────────────────────────────────────────
    section: { marginBottom: 18 },
    sectionLabel: {
      fontFamily: "NotoSans",   // label in Latin always
      fontWeight: "bold",
      fontSize: 7.5,
      color: "#3b82f6",
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginBottom: 8,
      paddingBottom: 5,
      borderBottomWidth: 1,
      borderBottomColor: "#dbeafe",
    },

    // ── Executive summary ──────────────────────────────────────
    summaryBox: {
      padding: 13,
      backgroundColor: "#f0f9ff",
      borderRadius: 5,
      borderLeftWidth: 3,
      borderLeftColor: "#3b82f6",
    },
    summaryText: {
      fontFamily: body,
      fontSize: 10.5,
      lineHeight: 1.75,
      color: "#1e293b",
      textAlign: "justify",
    },

    // ── Bullet points ──────────────────────────────────────────
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 7,
      gap: 9,
    },
    blueDot: {
      marginTop: 5,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#3b82f6",
      flexShrink: 0,
    },
    amberDot: {
      marginTop: 5,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#f59e0b",
      flexShrink: 0,
    },
    rowText: {
      fontFamily: body,
      flex: 1,
      fontSize: 10.5,
      lineHeight: 1.65,
      color: "#334155",
    },

    // ── Action step cards ──────────────────────────────────────
    stepCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 9,
      padding: 10,
      backgroundColor: "#f8fafc",
      borderRadius: 5,
      borderWidth: 1,
      borderColor: "#e2e8f0",
      gap: 9,
    },
    stepBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "#3b82f6",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      marginTop: 1,
    },
    stepBadgeText: {
      fontFamily: "NotoSans",
      fontWeight: "bold",
      fontSize: 8,
      color: "#ffffff",
    },
    stepText: {
      fontFamily: body,
      flex: 1,
      fontSize: 10.5,
      lineHeight: 1.65,
      color: "#334155",
    },

    // ── Financial box ──────────────────────────────────────────
    finBox: {
      padding: 13,
      backgroundColor: "#f0fdf4",
      borderRadius: 5,
      borderTopWidth: 3,
      borderTopColor: "#10b981",
    },
    finText: {
      fontFamily: body,
      fontSize: 10.5,
      lineHeight: 1.75,
      color: "#1e293b",
      textAlign: "justify",
    },

    // ── Closing note ───────────────────────────────────────────
    closingBox: {
      padding: 13,
      backgroundColor: "#fefce8",
      borderRadius: 5,
      borderLeftWidth: 3,
      borderLeftColor: "#eab308",
    },
    closingText: {
      fontFamily: body,
      fontSize: 10.5,
      lineHeight: 1.7,
      color: "#422006",
    },

    // ── Footer ─────────────────────────────────────────────────
    footer: {
      position: "absolute",
      bottom: 18,
      left: 48,
      right: 48,
      flexDirection: "row",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: "#e2e8f0",
      paddingTop: 7,
    },
    footerText: {
      fontFamily: "NotoSans",
      fontSize: 7.5,
      color: "#94a3b8",
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA TYPES & PARSER
// ─────────────────────────────────────────────────────────────────────────────

interface ReportData {
  reportTitle: string;
  executiveSummary: string;
  currentState: { heading: string; points: string[] };
  problemsIdentified: { heading: string; points: string[] };
  actionPlan: { heading: string; steps: string[] };
  financialSummary: string;
  closingNote: string;
}

function parseReportData(raw: string): ReportData {
  const fallback: ReportData = {
    reportTitle: "Business State Report",
    executiveSummary: "Report data unavailable. Please regenerate.",
    currentState:       { heading: "Current State",  points: [] },
    problemsIdentified: { heading: "Problems Found", points: [] },
    actionPlan:         { heading: "Action Plan",    steps: [] },
    financialSummary: "",
    closingNote: "",
  };
  try {
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");
    const p = JSON.parse(cleaned);
    return {
      reportTitle:        p.reportTitle        || fallback.reportTitle,
      executiveSummary:   p.executiveSummary   || fallback.executiveSummary,
      currentState:       {
        heading: p.currentState?.heading || fallback.currentState.heading,
        points:  Array.isArray(p.currentState?.points) ? p.currentState.points : [],
      },
      problemsIdentified: {
        heading: p.problemsIdentified?.heading || fallback.problemsIdentified.heading,
        points:  Array.isArray(p.problemsIdentified?.points) ? p.problemsIdentified.points : [],
      },
      actionPlan: {
        heading: p.actionPlan?.heading || fallback.actionPlan.heading,
        steps:   Array.isArray(p.actionPlan?.steps) ? p.actionPlan.steps : [],
      },
      financialSummary: p.financialSummary || "",
      closingNote:      p.closingNote      || "",
    };
  } catch {
    return { ...fallback, executiveSummary: raw || fallback.executiveSummary };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface GrowthAnalysisPDFProps {
  /** JSON string from the AI (new chat-based report format) */
  summary: string;
  companyName?: string;
  /** Defaults to "english" for backwards-compat */
  language?: ReportLanguage;
}

export const GrowthAnalysisPDF = ({
  summary,
  companyName,
  language = "english",
}: GrowthAnalysisPDFProps) => {
  const s    = makeStyles(language);
  const data = parseReportData(summary);

  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const footerLeft = sanitize(companyName ?? "Business Report");
  const metaLine   = `${today} · AI-Generated Business State Report`;

  return (
    <Document
      title={sanitize(data.reportTitle)}
      author="Business AI Advisor"
    >
      {/* ══ PAGE 1 — Summary + Current State ════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        {/* Cover */}
        <View style={s.coverBand}>
          <View style={s.accentBar} />
          <Text style={s.companyName}>
            {sanitize((companyName ?? "BUSINESS").toUpperCase())}
          </Text>
          <Text style={s.reportTitle}>{sanitize(data.reportTitle)}</Text>
          <Text style={s.reportMeta}>{metaLine}</Text>
        </View>

        <View style={s.body}>
          {/* 01 Summary */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>01 · Summary</Text>
            <View style={s.summaryBox}>
              <Text style={s.summaryText}>
                {sanitize(data.executiveSummary)}
              </Text>
            </View>
          </View>

          {/* 02 Current State */}
          {data.currentState.points.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>
                {"02 · "}
                {sanitize(data.currentState.heading)}
              </Text>
              {data.currentState.points.map((pt, i) => (
                <View key={i} style={s.row}>
                  <View style={s.blueDot} />
                  <Text style={s.rowText}>{sanitize(pt)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{footerLeft}</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>

      {/* ══ PAGE 2 — Problems + Action Plan + Finance + Closing ═════════════ */}
      <Page size="A4" style={s.page}>
        <View style={s.coverBand}>
          <View style={s.accentBar} />
          <Text style={s.companyName}>
            {sanitize((companyName ?? "BUSINESS").toUpperCase())}
          </Text>
          <Text style={s.reportTitle}>
            {sanitize(data.problemsIdentified.heading)}
            {" & "}
            {sanitize(data.actionPlan.heading)}
          </Text>
          <Text style={s.reportMeta}>{metaLine}</Text>
        </View>

        <View style={s.body}>
          {/* 03 Problems */}
          {data.problemsIdentified.points.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>
                {"03 · "}
                {sanitize(data.problemsIdentified.heading)}
              </Text>
              {data.problemsIdentified.points.map((pt, i) => (
                <View key={i} style={s.row}>
                  <View style={s.amberDot} />
                  <Text style={s.rowText}>{sanitize(pt)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 04 Action Plan */}
          {data.actionPlan.steps.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>
                {"04 · "}
                {sanitize(data.actionPlan.heading)}
              </Text>
              {data.actionPlan.steps.map((step, i) => (
                <View key={i} style={s.stepCard}>
                  <View style={s.stepBadge}>
                    <Text style={s.stepBadgeText}>{i + 1}</Text>
                  </View>
                  <Text style={s.stepText}>{sanitize(step)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 05 Financial Summary */}
          {data.financialSummary ? (
            <View style={s.section}>
              <Text style={s.sectionLabel}>05 · Financial Summary</Text>
              <View style={s.finBox}>
                <Text style={s.finText}>
                  {sanitize(data.financialSummary)}
                </Text>
              </View>
            </View>
          ) : null}

          {/* 06 Closing Note */}
          {data.closingNote ? (
            <View style={s.section}>
              <Text style={s.sectionLabel}>06 · Closing Note</Text>
              <View style={s.closingBox}>
                <Text style={s.closingText}>
                  {sanitize(data.closingNote)}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{footerLeft}</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
};