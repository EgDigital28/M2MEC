/**
 * When the today's plays email is checked, in Eastern time: the same every
 * day. vercel.json fires the job across the UTC hours that cover both EST and
 * EDT; the job keeps exactly these hours.
 */
export const CHECK_HOURS_ET = [5, 7, 9, 11, 14, 16, 19, 21];
