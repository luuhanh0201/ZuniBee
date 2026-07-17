import { boundedConcurrency, mapWithConcurrency } from './bounded-concurrency';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

async function nextTurn(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe('boundedConcurrency', () => {
  it('uses fallback for missing/invalid values and clamps configured values', () => {
    expect(boundedConcurrency(undefined, 3, 6)).toBe(3);
    expect(boundedConcurrency('', 3, 6)).toBe(3);
    expect(boundedConcurrency('invalid', 3, 6)).toBe(3);
    expect(boundedConcurrency(0, 3, 6)).toBe(1);
    expect(boundedConcurrency(-10, 3, 6)).toBe(1);
    expect(boundedConcurrency('3.9', 2, 6)).toBe(3);
    expect(boundedConcurrency(999, 3, 6)).toBe(6);
  });
});

describe('mapWithConcurrency', () => {
  it('caps active tasks and preserves input order when completion is reversed', async () => {
    const gates = Array.from({ length: 6 }, () => deferred<string>());
    const started: number[] = [];
    let active = 0;
    let maxActive = 0;
    const resultPromise = mapWithConcurrency(
      [0, 1, 2, 3, 4, 5],
      3,
      async (item) => {
        started.push(item);
        active += 1;
        maxActive = Math.max(maxActive, active);
        try {
          return await gates[item].promise;
        } finally {
          active -= 1;
        }
      },
    );

    await nextTurn();
    expect(started).toEqual([0, 1, 2]);
    gates[2].resolve('value-2');
    await nextTurn();
    expect(started).toEqual([0, 1, 2, 3]);
    gates[1].resolve('value-1');
    await nextTurn();
    gates[0].resolve('value-0');
    await nextTurn();
    expect(maxActive).toBe(3);
    expect(started).toEqual([0, 1, 2, 3, 4, 5]);

    gates[5].resolve('value-5');
    gates[4].resolve('value-4');
    gates[3].resolve('value-3');
    await expect(resultPromise).resolves.toEqual([
      'value-0',
      'value-1',
      'value-2',
      'value-3',
      'value-4',
      'value-5',
    ]);
  });

  it('stops scheduling, drains in-flight tasks and throws deterministically', async () => {
    const gates = [deferred<number>(), deferred<number>()];
    const started: number[] = [];
    let settled = false;
    const errorAtZero = new Error('chunk 0 failed');
    const errorAtOne = new Error('chunk 1 failed first');
    const outcome = mapWithConcurrency([0, 1, 2, 3], 2, async (item) => {
      started.push(item);
      if (item > 1) return item;
      return gates[item].promise;
    }).then(
      () => ({ error: null }),
      (error: unknown) => ({ error }),
    );
    void outcome.finally(() => {
      settled = true;
    });

    await nextTurn();
    gates[1].reject(errorAtOne);
    await nextTurn();
    expect(started).toEqual([0, 1]);
    expect(settled).toBe(false);

    gates[0].reject(errorAtZero);
    const result = await outcome;
    expect(result.error).toBe(errorAtZero);
    expect(started).toEqual([0, 1]);
    expect(settled).toBe(true);
  });
});
