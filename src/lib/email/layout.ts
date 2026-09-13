import { getWinPctTier } from "@/lib/bets/calculations";
import { escapeHtml } from "@/lib/email/utils";

export const EMAIL_COLORS = {
  background: "#06080f",
  foreground: "#e8edf5",
  muted: "#8b95a8",
  accent: "#3b82f6",
  surface: "#0d1117",
  surfaceElevated: "#151b26",
  surfaceAlt: "#121820",
  border: "#1e2936",
  profit: "#34d399",
  loss: "#f87171",
  warning: "#fbbf24",
} as const;

export function emailProfitLossColor(value: number) {
  if (value > 0) {
    return EMAIL_COLORS.profit;
  }

  if (value < 0) {
    return EMAIL_COLORS.loss;
  }

  return EMAIL_COLORS.muted;
}

export function emailWinPctColor(winPct: number | null) {
  switch (getWinPctTier(winPct)) {
    case "green":
      return EMAIL_COLORS.profit;
    case "yellow":
      return EMAIL_COLORS.warning;
    case "red":
      return EMAIL_COLORS.loss;
    default:
      return EMAIL_COLORS.muted;
  }
}

type EmailSectionParams = {
  eyebrow: string;
  title: string;
  subtitle: string;
};

type EmailTableColumn = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  mono?: boolean;
};

type EmailTableRow = {
  cells: string[];
  cellColors?: (string | undefined)[];
};

export function wrapEmailDocument(body: string) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>M2MEC</title>
  </head>
  <body style="margin:0;padding:0;background:${EMAIL_COLORS.background};color:${EMAIL_COLORS.foreground};font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">
    ${body}
  </body>
</html>`;
}

export function renderEmailShell(content: string) {
  return wrapEmailDocument(`
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${EMAIL_COLORS.background};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:${EMAIL_COLORS.surface};border:1px solid ${EMAIL_COLORS.border};border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px;">
                ${content}
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:${EMAIL_COLORS.muted};text-align:center;">
            Sent from M2MEC · noreply@m2mec.com
          </p>
        </td>
      </tr>
    </table>
  `);
}

export function renderEmailSection({ eyebrow, title, subtitle }: EmailSectionParams) {
  return `
    <p style="margin:0 0 12px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${EMAIL_COLORS.accent};">
      ${escapeHtml(eyebrow)}
    </p>
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:600;letter-spacing:-0.02em;color:${EMAIL_COLORS.foreground};">
      ${escapeHtml(title)}
    </h1>
    <p style="margin:0;font-size:14px;line-height:1.5;color:${EMAIL_COLORS.muted};">
      ${escapeHtml(subtitle)}
    </p>
  `;
}

export function renderEmailParagraph(text: string) {
  return `
    <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:${EMAIL_COLORS.muted};">
      ${text}
    </p>
  `;
}

export function renderEmailDisclaimer(text: string) {
  return `
    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid ${EMAIL_COLORS.border};font-size:11px;line-height:1.6;color:${EMAIL_COLORS.muted};">
      ${escapeHtml(text)}
    </p>
  `;
}

export function renderEmailButton(href: string, label: string) {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px;">
      <tr>
        <td style="border-radius:999px;background:${EMAIL_COLORS.foreground};">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:${EMAIL_COLORS.background};text-decoration:none;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function cellStyle(column: EmailTableColumn, color?: string) {
  const align = column.align ?? "left";
  const fontFamily = column.mono
    ? "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace"
    : "inherit";

  return `padding:8px;font-size:12px;line-height:1.4;text-align:${align};font-family:${fontFamily};color:${color ?? EMAIL_COLORS.foreground};vertical-align:top;`;
}

export function renderEmailTable(columns: EmailTableColumn[], rows: EmailTableRow[]) {
  const headerCells = columns
    .map(
      (column) => `
        <th style="${cellStyle({ ...column, mono: false }, EMAIL_COLORS.muted)}font-weight:500;border-bottom:1px solid ${EMAIL_COLORS.border};background:${EMAIL_COLORS.surfaceElevated};">
          ${escapeHtml(column.label)}
        </th>
      `,
    )
    .join("");

  const bodyRows = rows
    .map((row, index) => {
      const rowBackground = index % 2 === 0 ? EMAIL_COLORS.surface : EMAIL_COLORS.surfaceAlt;

      const cells = row.cells
        .map((value, cellIndex) => {
          const column = columns[cellIndex];
          const color = row.cellColors?.[cellIndex];

          return `
            <td style="${cellStyle(column, color)}border-top:1px solid ${EMAIL_COLORS.border};background:${rowBackground};">
              ${value}
            </td>
          `;
        })
        .join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;border:1px solid ${EMAIL_COLORS.border};border-radius:12px;border-collapse:separate;border-spacing:0;overflow:hidden;">
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  `;
}

export function renderEmailEmptyState(message: string) {
  return `
    <p style="margin:20px 0 0;padding:16px;border:1px solid ${EMAIL_COLORS.border};border-radius:12px;background:${EMAIL_COLORS.surfaceElevated};font-size:13px;color:${EMAIL_COLORS.muted};text-align:center;">
      ${escapeHtml(message)}
    </p>
  `;
}

export function renderEmailSummaryLine(parts: string[]) {
  return `
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${EMAIL_COLORS.muted};">
      ${parts.join(` <span style="color:${EMAIL_COLORS.border};">·</span> `)}
    </p>
  `;
}

type EmailStatItem = {
  label: string;
  value: string;
  valueColor?: string;
};

export function renderEmailStatGrid(items: EmailStatItem[]) {
  const cells = items
    .map(
      (item) => `
        <td style="width:${Math.floor(100 / items.length)}%;padding:8px;vertical-align:top;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${EMAIL_COLORS.surfaceElevated};border:1px solid ${EMAIL_COLORS.border};border-radius:12px;">
            <tr>
              <td style="padding:12px 14px;">
                <p style="margin:0 0 6px;font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${EMAIL_COLORS.muted};">
                  ${escapeHtml(item.label)}
                </p>
                <p style="margin:0;font-size:18px;font-weight:600;color:${item.valueColor ?? EMAIL_COLORS.foreground};">
                  ${escapeHtml(item.value)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      `,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;border-collapse:separate;border-spacing:8px 0;">
      <tr>
        ${cells}
      </tr>
    </table>
  `;
}

export function renderEmailStatGridRows(rows: EmailStatItem[][], columns = 4) {
  const rowHtml = rows
    .map((items) => {
      const cells = items
        .map(
          (item) => `
            <td style="width:${Math.floor(100 / columns)}%;padding:4px;vertical-align:top;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${EMAIL_COLORS.surfaceElevated};border:1px solid ${EMAIL_COLORS.border};border-radius:12px;">
                <tr>
                  <td style="padding:12px 14px;">
                    <p style="margin:0 0 6px;font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${EMAIL_COLORS.muted};">
                      ${escapeHtml(item.label)}
                    </p>
                    <p style="margin:0;font-size:18px;font-weight:600;color:${item.valueColor ?? EMAIL_COLORS.foreground};">
                      ${escapeHtml(item.value)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          `,
        )
        .join("");

      const fillerCount = Math.max(columns - items.length, 0);
      const fillers = Array.from({ length: fillerCount })
        .map(() => `<td style="width:${Math.floor(100 / columns)}%;padding:4px;"></td>`)
        .join("");

      return `<tr>${cells}${fillers}</tr>`;
    })
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;border-collapse:separate;border-spacing:0;">
      ${rowHtml}
    </table>
  `;
}

export function renderEmailHtmlCell(value: string) {
  return escapeHtml(value);
}
