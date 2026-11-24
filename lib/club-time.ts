// One clock for every calendar-day feature in the club.
//
// Timestamps stay absolute UTC instants in storage. A "club day", however,
// is the civil day in Bucharest, including its 23- and 25-hour DST days. Keep
// those two concepts separate: a YYYY-MM-DD club date is not UTC midnight.

export const CLUB_TIME_ZONE = 'Europe/Bucharest';

const DAY_PARTS = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
  timeZone: CLUB_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const CLOCK_PARTS = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
  timeZone: CLUB_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

type DateParts = { year: number; month: number; day: number };
type ClockParts = DateParts & { hour: number; minute: number; second: number };

function numericParts(formatter: Intl.DateTimeFormat, date: Date): Record<string, number> {
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
}

function partsOfDay(date: Date): DateParts {
  const parts = numericParts(DAY_PARTS, date);
  return { year: parts.year, month: parts.month, day: parts.day };
}

function partsOfClock(date: Date): ClockParts {
  const parts = numericParts(CLOCK_PARTS, date);
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function dateKey(parts: DateParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function parseClubDate(day: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new RangeError(`Invalid club date: ${day}`);
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const check = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    check.getUTCFullYear() !== parts.year
    || check.getUTCMonth() !== parts.month - 1
    || check.getUTCDate() !== parts.day
  ) throw new RangeError(`Invalid club date: ${day}`);
  return parts;
}

/** YYYY-MM-DD in the clubhouse's explicit civil timezone. */
export function clubDay(now: Date = new Date()): string {
  if (!Number.isFinite(now.getTime())) throw new RangeError('Invalid instant');
  return dateKey(partsOfDay(now));
}

/** Move an abstract club date by whole calendar days, independent of DST. */
export function shiftClubDay(day: string, amount: number): string {
  if (!Number.isInteger(amount)) throw new RangeError('Club-day shift must be an integer');
  const parts = parseClubDate(day);
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return dateKey({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

// Offset at one instant, derived from Intl rather than from the device's own
// timezone. Milliseconds are rounded away because formatToParts stops at
// seconds; every boundary constructed below is itself on a whole second.
function clubOffsetAt(at: number): number {
  const rounded = Math.trunc(at / 1000) * 1000;
  const parts = partsOfClock(new Date(rounded));
  const wallAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return wallAsUtc - rounded;
}

/** Exact UTC instant at which one Bucharest calendar date begins. */
export function clubDateStart(day: string): Date {
  const parts = parseClubDate(day);
  const wallMidnight = Date.UTC(parts.year, parts.month - 1, parts.day);
  let instant = wallMidnight;

  // Resolve the zone offset at the destination rather than at today's date.
  // Two passes are normally sufficient; four keeps the conversion stable if
  // an offset transition sits between the initial UTC guess and the result.
  for (let pass = 0; pass < 4; pass += 1) {
    const next = wallMidnight - clubOffsetAt(instant);
    if (next === instant) break;
    instant = next;
  }

  const result = new Date(instant);
  if (clubDay(result) !== day) throw new RangeError(`Could not resolve club date: ${day}`);
  return result;
}

/** Convert a YYYY-MM-DDTHH:mm clubhouse wall time into an absolute instant. */
export function clubWallTime(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new RangeError(`Invalid club wall time: ${value}`);
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  const parts = parseClubDate(date);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (hour > 23 || minute > 59) throw new RangeError(`Invalid club wall time: ${value}`);
  const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute);
  let instant = wallAsUtc;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = wallAsUtc - clubOffsetAt(instant);
    if (next === instant) break;
    instant = next;
  }
  const result = new Date(instant);
  const resolved = partsOfClock(result);
  if (
    resolved.year !== parts.year || resolved.month !== parts.month || resolved.day !== parts.day
    || resolved.hour !== hour || resolved.minute !== minute
  ) throw new RangeError(`Club wall time does not exist: ${value}`);
  return result;
}

/** Start of today's Bucharest calendar day as an absolute instant. */
export function clubDayStart(now: Date = new Date()): Date {
  return clubDateStart(clubDay(now));
}

/** Start of a rolling N-club-day window, including the current club day. */
export function clubWindowStart(days: number, now: Date = new Date()): Date {
  if (!Number.isInteger(days) || days < 1) throw new RangeError('Club-day window must be positive');
  return clubDateStart(shiftClubDay(clubDay(now), -(days - 1)));
}

/** The next Bucharest midnight after the supplied instant. */
export function nextClubDayStart(now: Date = new Date()): Date {
  return clubDateStart(shiftClubDay(clubDay(now), 1));
}

/** Stable civil-day ordinal for deterministic daily seeds. */
export function clubDayNumber(now: Date = new Date()): number {
  const parts = parseClubDate(clubDay(now));
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000);
}
