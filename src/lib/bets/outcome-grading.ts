import type { BetStatus } from "@/lib/bets/calculations";

export const DEFAULT_OUTCOMES_API_URL =
  "https://thepredictionledger.vercel.app/api/v1/event-outcomes/grade";

export type OpenBetForGrading = {
  id: string;
  event_date: string;
  event_name: string;
  sports?: { abbreviation: string } | null;
};

type Outcome = "won" | "lost" | "push" | "void";

export type OutcomeGradeData = {
  resolution: "graded" | "pending" | "no_match" | "ambiguous" | "unsupported_market";
  outcome: Outcome | null;
  reason: string;
};

type OutcomeGradeEnvelope = { api_version: "1"; data: OutcomeGradeData };

export type GradeAttempt =
  | { kind: "graded"; status: BetStatus; data: OutcomeGradeData }
  | { kind: "unresolved"; data: OutcomeGradeData }
  | { kind: "skipped"; reason: string }
  | { kind: "failed"; reason: string };

export function outcomeApiSport(abbreviation: string): string | null {
  const normalized = abbreviation.trim().toLowerCase();
  if (normalized === "ufc") return "UFC";
  if (normalized === "mlb") return "MLB";
  if (normalized === "nfl") return "NFL";
  if (normalized === "nba") return "NBA";
  if (normalized === "nhl") return "NHL";
  if (normalized.startsWith("tennis")) return "tennis";
  return null;
}

export function outcomeToBetStatus(outcome: Outcome): BetStatus {
  if (outcome === "won") return "Win";
  if (outcome === "lost") return "Loss";
  return "Void";
}

function isOutcome(value: unknown): value is Outcome {
  return value === "won" || value === "lost" || value === "push" || value === "void";
}

function isGradeData(value: unknown): value is OutcomeGradeData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<OutcomeGradeData>;
  return (
    ["graded", "pending", "no_match", "ambiguous", "unsupported_market"].includes(data.resolution ?? "") &&
    (data.outcome === null || isOutcome(data.outcome)) &&
    typeof data.reason === "string"
  );
}

export async function requestOutcomeGrade(
  bet: OpenBetForGrading,
  options: { apiUrl: string; apiKey: string; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<GradeAttempt> {
  const sport = outcomeApiSport(bet.sports?.abbreviation ?? "");
  if (!sport) return { kind: "skipped", reason: "Sport is not supported by the outcomes API." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);

  try {
    const response = await (options.fetchImpl ?? fetch)(options.apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ event_date: bet.event_date, sport, wager_description: bet.event_name }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return { kind: "failed", reason: `Outcomes API returned HTTP ${response.status}.` };

    const envelope = (await response.json()) as Partial<OutcomeGradeEnvelope>;
    if (envelope.api_version !== "1" || !isGradeData(envelope.data)) {
      return { kind: "failed", reason: "Outcomes API returned an invalid response." };
    }
    if (envelope.data.resolution !== "graded") return { kind: "unresolved", data: envelope.data };
    if (!isOutcome(envelope.data.outcome)) {
      return { kind: "failed", reason: "A graded response did not include an outcome." };
    }
    return { kind: "graded", status: outcomeToBetStatus(envelope.data.outcome), data: envelope.data };
  } catch (error) {
    return {
      kind: "failed",
      reason: error instanceof Error && error.name === "AbortError"
        ? "Outcomes API request timed out."
        : "Outcomes API request failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
