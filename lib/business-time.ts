const DEFAULT_BUSINESS_TIME_ZONE = 'Asia/Tomsk';

function formatDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`Failed to format date for time zone "${timeZone}"`);
  }

  return `${year}-${month}-${day}`;
}

export function getBusinessTimeZone(): string {
  return process.env.BUSINESS_TIMEZONE?.trim()
    || process.env.TZ?.trim()
    || DEFAULT_BUSINESS_TIME_ZONE;
}

/** Returns YYYY-MM-DD in the business timezone instead of UTC. */
export function getBusinessToday(date = new Date()): string {
  const configuredTimeZone = getBusinessTimeZone();

  try {
    return formatDateInTimeZone(date, configuredTimeZone);
  } catch (error) {
    console.warn(
      `[business-time] Invalid time zone "${configuredTimeZone}", falling back to ${DEFAULT_BUSINESS_TIME_ZONE}`,
      error,
    );
    return formatDateInTimeZone(date, DEFAULT_BUSINESS_TIME_ZONE);
  }
}
