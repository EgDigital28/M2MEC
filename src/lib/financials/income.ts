export type IncomeContract = {
  id: string;
  name: string;
  counterparty: string | null;
  annual_amount: number;
  /** Share withheld for tax; recognised figures are reported net of it. */
  tax_rate: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

export type IncomeYear = {
  year: number;
  /** Net of tax. */
  amount: number;
  grossAmount: number;
  activeDays: number;
  daysInYear: number;
  prorated: boolean;
};

const MS_PER_DAY = 86_400_000;

export const DEFAULT_TAX_RATE = 0.3;

export function taxRateFor(contract: Pick<IncomeContract, "tax_rate">) {
  const rate = Number(contract.tax_rate);
  return Number.isFinite(rate) && rate >= 0 && rate < 1 ? rate : DEFAULT_TAX_RATE;
}

/** Annual contract value after tax — the figure everything downstream uses. */
export function netAnnualAmount(contract: Pick<IncomeContract, "annual_amount" | "tax_rate">) {
  return Number(contract.annual_amount) * (1 - taxRateFor(contract));
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function daysInYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

/** Inclusive day count between two UTC timestamps. */
function inclusiveDays(from: number, to: number) {
  return to < from ? 0 : Math.round((to - from) / MS_PER_DAY) + 1;
}

/**
 * Days the contract is live inside a calendar year. Recognition is daily, so a
 * contract starting mid-year recognises only the remainder of that year and
 * every later year recognises in full.
 */
export function activeDaysInYear(contract: IncomeContract, year: number) {
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year, 11, 31);
  const start = Math.max(parseDate(contract.start_date), yearStart);
  const end = Math.min(contract.end_date ? parseDate(contract.end_date) : yearEnd, yearEnd);

  return inclusiveDays(start, end);
}

export function recognizedForYear(contract: IncomeContract, year: number): IncomeYear {
  const total = daysInYear(year);
  const activeDays = activeDaysInYear(contract, year);
  const share = activeDays / total;

  return {
    year,
    amount: netAnnualAmount(contract) * share,
    grossAmount: Number(contract.annual_amount) * share,
    activeDays,
    daysInYear: total,
    prorated: activeDays > 0 && activeDays < total,
  };
}

/** Recognition schedule per calendar year, from the first year to `throughYear`. */
export function recognitionSchedule(contract: IncomeContract, throughYear: number) {
  const firstYear = Number(contract.start_date.slice(0, 4));
  const years: IncomeYear[] = [];

  for (let year = firstYear; year <= throughYear; year += 1) {
    const recognized = recognizedForYear(contract, year);
    if (recognized.activeDays > 0) {
      years.push(recognized);
    }
  }

  return years;
}

/**
 * Amount earned from the contract start through `asOf`, inclusive. This is the
 * accrual figure — what has actually been earned rather than what the year will
 * eventually total.
 */
export function earnedToDate(contract: IncomeContract, asOf = new Date()) {
  const asOfUtc = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const start = parseDate(contract.start_date);

  if (asOfUtc < start) {
    return 0;
  }

  const end = contract.end_date ? Math.min(parseDate(contract.end_date), asOfUtc) : asOfUtc;
  let earned = 0;

  for (let year = Number(contract.start_date.slice(0, 4)); ; year += 1) {
    const yearStart = Date.UTC(year, 0, 1);
    if (yearStart > end) break;

    const from = Math.max(start, yearStart);
    const to = Math.min(end, Date.UTC(year, 11, 31));
    earned += (netAnnualAmount(contract) * inclusiveDays(from, to)) / daysInYear(year);
  }

  return earned;
}

export function sumEarnedToDate(contracts: IncomeContract[], asOf = new Date()) {
  return contracts
    .filter((contract) => contract.is_active)
    .reduce((total, contract) => total + earnedToDate(contract, asOf), 0);
}

export function sumRecognizedForYear(contracts: IncomeContract[], year: number) {
  return contracts
    .filter((contract) => contract.is_active)
    .reduce((total, contract) => total + recognizedForYear(contract, year).amount, 0);
}

/**
 * Net income recognised across an inclusive span of calendar years. Pool value
 * is compared against next year's forecast spend, so it carries the income
 * expected over the same horizon rather than only what has been earned so far.
 */
export function sumRecognizedAcrossYears(
  contracts: IncomeContract[],
  fromYear: number,
  toYear: number,
) {
  let total = 0;

  for (let year = fromYear; year <= toYear; year += 1) {
    total += sumRecognizedForYear(contracts, year);
  }

  return total;
}

export function formatIncomeAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatContractDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type IncomeContractPayload = {
  name?: unknown;
  counterparty?: unknown;
  annual_amount?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  is_active?: unknown;
  notes?: unknown;
  tax_rate?: unknown;
};

/** Shared by create and update so both reject the same shapes. */
export function validateIncomePayload(body: IncomeContractPayload) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const annualAmount = Number(body.annual_amount);
  const startDate = typeof body.start_date === "string" ? body.start_date : "";
  const endDate =
    body.end_date === null || body.end_date === undefined || body.end_date === ""
      ? null
      : String(body.end_date);

  if (!name || name.length > 120) {
    return { error: "Enter a contract name of 1 to 120 characters." as const };
  }

  if (!Number.isFinite(annualAmount) || annualAmount < 0) {
    return { error: "Enter a valid annual amount." as const };
  }

  const taxRate = body.tax_rate === undefined ? DEFAULT_TAX_RATE : Number(body.tax_rate);

  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate >= 1) {
    return { error: "Enter a tax rate between 0 and 1." as const };
  }

  if (!ISO_DATE.test(startDate) || Number.isNaN(Date.parse(startDate))) {
    return { error: "Enter a valid start date." as const };
  }

  if (endDate !== null && (!ISO_DATE.test(endDate) || Number.isNaN(Date.parse(endDate)))) {
    return { error: "Enter a valid end date." as const };
  }

  if (endDate !== null && endDate < startDate) {
    return { error: "The end date cannot be before the start date." as const };
  }

  const counterparty =
    typeof body.counterparty === "string" && body.counterparty.trim().length > 0
      ? body.counterparty.trim().slice(0, 120)
      : null;
  const notes =
    typeof body.notes === "string" && body.notes.trim().length > 0
      ? body.notes.trim().slice(0, 2000)
      : null;

  return {
    values: {
      name,
      counterparty,
      annual_amount: annualAmount,
      tax_rate: taxRate,
      start_date: startDate,
      end_date: endDate,
      is_active: body.is_active === undefined ? true : Boolean(body.is_active),
      notes,
    },
  };
}
