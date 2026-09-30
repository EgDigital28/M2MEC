/**
 * Capital lock for the betting pool.
 *
 * Ownership cannot be re-split by total deposits when someone adds capital
 * later: that would hand the new money a share of gains it was not present
 * for. Instead each deposit event freezes every holder's value at that
 * instant, credits only the depositor, and re-derives percentages against the
 * enlarged pool.
 */

export type LockDeposit = {
  profileId: string;
  depositedOn: string;
  amount: number;
};

export type LockEvent = {
  date: string;
  poolValueBefore: number;
  deposited: number;
  poolValueAfter: number;
  /** Ownership immediately after the event, by profile. */
  ownership: Record<string, number>;
};

export type LockResult = {
  /** Current ownership share per profile, summing to 1. */
  ownership: Map<string, number>;
  /** Deposits made at inception, which set the opening split. */
  openingTotal: number;
  /** Deposits after inception, which trigger a lock event. */
  addedByProfile: Map<string, number>;
  inceptionDate: string | null;
  events: LockEvent[];
};

function emptyResult(): LockResult {
  return {
    ownership: new Map(),
    openingTotal: 0,
    addedByProfile: new Map(),
    inceptionDate: null,
    events: [],
  };
}

/**
 * `poolValueBefore` is the pool's worth immediately before a given date,
 * excluding that date's deposits. Supplying it separately keeps this function
 * free of any assumption about where value comes from.
 */
export function computeCapitalLock(
  deposits: LockDeposit[],
  poolValueBefore: (date: string) => number,
): LockResult {
  if (deposits.length === 0) {
    return emptyResult();
  }

  const sorted = [...deposits].sort((a, b) => a.depositedOn.localeCompare(b.depositedOn));
  const inceptionDate = sorted[0].depositedOn;

  const opening = sorted.filter((deposit) => deposit.depositedOn === inceptionDate);
  const later = sorted.filter((deposit) => deposit.depositedOn !== inceptionDate);

  const openingTotal = opening.reduce((sum, deposit) => sum + deposit.amount, 0);
  const ownership = new Map<string, number>();

  for (const deposit of opening) {
    const share = openingTotal > 0 ? deposit.amount / openingTotal : 0;
    ownership.set(deposit.profileId, (ownership.get(deposit.profileId) ?? 0) + share);
  }

  const addedByProfile = new Map<string, number>();
  const events: LockEvent[] = [];

  // Deposits on the same day are one event: they are simultaneous, so none of
  // them dilutes another.
  const byDate = new Map<string, LockDeposit[]>();
  for (const deposit of later) {
    byDate.set(deposit.depositedOn, [...(byDate.get(deposit.depositedOn) ?? []), deposit]);
  }

  for (const [date, sameDay] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const valueBefore = poolValueBefore(date);
    const deposited = sameDay.reduce((sum, deposit) => sum + deposit.amount, 0);

    // Freeze: everyone's value at this instant, before new money lands.
    const locked = new Map<string, number>();
    for (const [profileId, share] of ownership) {
      locked.set(profileId, share * valueBefore);
    }

    for (const deposit of sameDay) {
      locked.set(deposit.profileId, (locked.get(deposit.profileId) ?? 0) + deposit.amount);
      addedByProfile.set(
        deposit.profileId,
        (addedByProfile.get(deposit.profileId) ?? 0) + deposit.amount,
      );
    }

    const poolValueAfter = valueBefore + deposited;

    ownership.clear();
    for (const [profileId, value] of locked) {
      ownership.set(profileId, poolValueAfter > 0 ? value / poolValueAfter : 0);
    }

    events.push({
      date,
      poolValueBefore: valueBefore,
      deposited,
      poolValueAfter,
      ownership: Object.fromEntries(ownership),
    });
  }

  return { ownership, openingTotal, addedByProfile, inceptionDate, events };
}

/**
 * Pool worth immediately before `date`: the opening bankroll, trading profit
 * and loss settled before then, and any capital added since inception.
 * Deposits made at inception are already represented by the opening bankroll.
 */
export function makePoolValueBefore({
  openingBankroll,
  dailyProfitLoss,
  deposits,
  inceptionDate,
}: {
  openingBankroll: number;
  dailyProfitLoss: { date: string; profitLoss: number }[];
  deposits: LockDeposit[];
  inceptionDate: string | null;
}) {
  const sortedPl = [...dailyProfitLoss].sort((a, b) => a.date.localeCompare(b.date));
  const addedSinceInception = deposits.filter(
    (deposit) => inceptionDate !== null && deposit.depositedOn > inceptionDate,
  );

  return (date: string) => {
    const pl = sortedPl
      .filter((point) => point.date < date)
      .reduce((sum, point) => sum + point.profitLoss, 0);
    const added = addedSinceInception
      .filter((deposit) => deposit.depositedOn < date)
      .reduce((sum, deposit) => sum + deposit.amount, 0);

    return openingBankroll + pl + added;
  };
}
