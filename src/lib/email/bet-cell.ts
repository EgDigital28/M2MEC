import type { BetEntryComputed } from "@/lib/bets/calculations";
import { describeLedgerEvent, parseLedgerEvents } from "@/lib/bets/ledger-events";
import { EMAIL_COLORS } from "@/lib/email/layout";
import { escapeHtml } from "@/lib/email/utils";

/**
 * One line per game under a bet, unlabelled: a game that has finished shows
 * its result ("North Texas Mean Green 45 – Tulsa Golden Hurricane 44 ·
 * Final"), one still to come its kick-off. A game on `day` shows only its time;
 * on another day it keeps its date. None for hand-entered plays.
 */
export function betEventLines(entry: BetEntryComputed, day: string) {
  return parseLedgerEvents(entry.ledger_events).map((event) => describeLedgerEvent(event, day));
}

/**
 * The bet, with its game or result lines beneath it in smaller text. Each
 * line is held to one line: email rows do not wrap. Shared by every email
 * that lists bets, so they all read the same.
 */
export function betCellHtml(entry: BetEntryComputed, day: string) {
  const lines = betEventLines(entry, day)
    .map(
      (line) =>
        `<br /><span style="font-size:10px;line-height:1.5;color:${EMAIL_COLORS.muted};white-space:nowrap;">${escapeHtml(line)}</span>`,
    )
    .join("");
  return `<span style="white-space:nowrap;">${escapeHtml(entry.event_name)}</span>${lines}`;
}
