const DURATION_PATTERN = /^(\d+)\s*(ms|s|m|h|d)$/;

const UNIT_IN_MILLISECONDS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function durationToMilliseconds(duration: string): number {
  const match = DURATION_PATTERN.exec(duration.trim());
  if (!match) {
    throw new Error(
      'Thời hạn "' +
        duration +
        '" không hợp lệ. Dùng định dạng như 15m, 1h hoặc 30d.',
    );
  }

  return Number(match[1]) * UNIT_IN_MILLISECONDS[match[2]];
}

export function addDuration(base: Date, duration: string): Date {
  return new Date(base.getTime() + durationToMilliseconds(duration));
}
