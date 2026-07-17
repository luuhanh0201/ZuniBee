/**
 * Chuẩn hóa concurrency lấy từ env để tránh 0, NaN hoặc giá trị quá lớn làm
 * cạn CPU/RAM và quota provider.
 */
export function boundedConcurrency(
  value: unknown,
  fallback: number,
  maximum: number,
): number {
  if (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
  )
    return Math.min(maximum, Math.max(1, Math.floor(fallback)));
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    return Math.min(maximum, Math.max(1, Math.floor(fallback)));
  return Math.min(maximum, Math.max(1, Math.floor(parsed)));
}

/**
 * Map song song có giới hạn, giữ nguyên thứ tự input.
 *
 * Khi một task lỗi, pool ngừng cấp task mới nhưng vẫn chờ toàn bộ task đang
 * chạy kết thúc trước khi throw. Điều này ngăn task cũ tiếp tục ghi checkpoint
 * sau khi BullMQ đã bắt đầu retry hoặc dọn artifact của job.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];
  const workerCount = Math.min(
    items.length,
    boundedConcurrency(concurrency, 1, Number.MAX_SAFE_INTEGER),
  );
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let failed = false;
  const errors: Array<{ index: number; error: unknown }> = [];

  const worker = async () => {
    while (!failed) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      try {
        results[index] = await mapper(items[index], index);
      } catch (error) {
        errors.push({ index, error });
        failed = true;
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (failed) {
    errors.sort((a, b) => a.index - b.index);
    throw errors[0]?.error;
  }
  return results;
}
