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
