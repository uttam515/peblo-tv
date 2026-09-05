export function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) {
    return '0m';
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;

  if (hours > 0) {
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  }
  if (mins === 0) {
    return `${secs}s`;
  }
  if (secs > 0 && mins < 5) {
    return `${mins}m ${secs}s`;
  }
  return `${mins}m`;
}

export function formatSeasonLabel(seasonNumber: number): string {
  if (seasonNumber === 0) {
    return 'Trailers';
  }
  return `Season ${seasonNumber}`;
}
