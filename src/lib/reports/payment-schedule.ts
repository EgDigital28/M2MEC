export type ScheduledPayment = {
  /** 1-based instalment number. */
  number: number;
  date: string;
  amount: number;
  /** Outstanding after this payment; the final row is always zero. */
  remaining: number;
};

const MS_PER_DAY = 86_400_000;

function utc(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function iso(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Weekly instalments that clear a balance by the end of the calendar year.
 *
 * Payments land on the chosen weekday, the first one strictly after today so
 * nobody is asked to pay retroactively. Amounts are whole dollars and the
 * final instalment absorbs the rounding, so the schedule sums to the balance
 * exactly rather than leaving a stray cent outstanding.
 */
export function recommendedPaymentSchedule(
  amountDue: number,
  {
    today = new Date(),
    weekday = 5, // Friday
    maxPayments = 60,
  }: { today?: Date; weekday?: number; maxPayments?: number } = {},
): ScheduledPayment[] {
  if (!Number.isFinite(amountDue) || amountDue <= 0) {
    return [];
  }

  const start = utc(today);
  const yearEnd = Date.UTC(new Date(start).getUTCFullYear(), 11, 31);

  const dates: number[] = [];
  let cursor = start + MS_PER_DAY;

  while (cursor <= yearEnd && dates.length < maxPayments) {
    if (new Date(cursor).getUTCDay() === weekday) {
      dates.push(cursor);
    }
    cursor += MS_PER_DAY;
  }

  // Past the last such weekday: a single payment on the deadline. On or after
  // the deadline itself it is due now — never schedule into the next year,
  // which would defeat the point of clearing the balance by year end.
  if (dates.length === 0) {
    dates.push(yearEnd > start ? yearEnd : start);
  }

  const total = Math.round(amountDue);
  const base = Math.floor(total / dates.length);
  let paid = 0;

  return dates.map((date, index) => {
    const isLast = index === dates.length - 1;
    const amount = isLast ? total - paid : base;
    paid += amount;

    return {
      number: index + 1,
      date: iso(date),
      amount,
      remaining: total - paid,
    };
  });
}

export function formatScheduleDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

const WEEKDAY = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * One sentence rather than a table — the plan is simple enough to read inline,
 * and a fourteen-row table earned none of the space it took.
 */
export function describePaymentSchedule(schedule: ScheduledPayment[]) {
  if (schedule.length === 0) {
    return "";
  }

  const first = schedule[0];
  const last = schedule[schedule.length - 1];

  if (schedule.length === 1) {
    return `Suggested: a single payment of ${money(first.amount)} on ${formatScheduleDate(first.date)}.`;
  }

  const day = WEEKDAY[new Date(`${first.date}T00:00:00Z`).getUTCDay()];
  const tail =
    last.amount === first.amount
      ? ""
      : `, with a final payment of ${money(last.amount)}`;

  return `Suggested: ${schedule.length} weekly payments of ${money(first.amount)} each ${day}, from ${formatScheduleDate(first.date)} to ${formatScheduleDate(last.date)}${tail}.`;
}
