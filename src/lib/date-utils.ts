export function isSameDateInTimeZone(
  firstTimestamp: number,
  secondTimestamp: number,
  timeZone: string,
) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(firstTimestamp) === formatter.format(secondTimestamp);
}
