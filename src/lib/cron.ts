import { timingSafeEqual } from "node:crypto";

/** Vercel sends CRON_SECRET as a bearer token; compared in constant time. */
export function isAuthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  return (
    Boolean(secret) &&
    Buffer.byteLength(supplied) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  );
}

/**
 * The hour in Eastern time. Vercel schedules in UTC, so jobs fire across a
 * wider UTC window and gate on this to hit the same Eastern hours in both EST
 * and EDT.
 */
export function easternHour(now = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
}
