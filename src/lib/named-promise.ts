export async function named_promise_all_settled<
  T extends Record<string, Promise<unknown>>,
>(
  promise_object: T,
): Promise<{ [K in keyof T]: PromiseSettledResult<Awaited<T[K]>> }> {
  const promise_keys = Object.keys(promise_object) as (keyof T)[];
  const promise_values = Object.values(promise_object);
  const all_settled = await Promise.allSettled(promise_values);

  const result_object = {} as {
    [K in keyof T]: PromiseSettledResult<Awaited<T[K]>>;
  };

  for (let i = 0; i < all_settled.length; i++) {
    const key = promise_keys[i];
    if (typeof key === "undefined") throw new Error("Key is undefined");

    result_object[key] = all_settled[i] as PromiseSettledResult<
      Awaited<T[typeof key]>
    >;
  }

  return result_object;
}
