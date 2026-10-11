/**
 * When the today's plays email is checked, in Eastern time. Weekends start
 * earlier because of early matches. vercel.json fires the job across the UTC
 * hours that cover both EST and EDT; the job keeps exactly these hours.
 */
export const WEEKDAY_HOURS_ET = [11, 14, 16, 19, 21];
export const WEEKEND_HOURS_ET = [7, 9, 11, 14, 16, 19, 21];

/** Check hours for a weekday where 0 is Sunday and 6 is Saturday. */
export function checkHoursFor(weekday: number) {
  return weekday === 0 || weekday === 6 ? WEEKEND_HOURS_ET : WEEKDAY_HOURS_ET;
}
