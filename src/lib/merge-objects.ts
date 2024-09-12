import { klona } from "klona";

export function merge_objects<T extends object, U extends object>(
  target: T,
  source: U,
): T & U {
  const result: T & U = klona(target) as T & U;

  Object.keys(source).forEach((key) => {
    const safe_key = key as keyof U;
    const value = source[safe_key];

    if (value !== undefined && value !== null) {
      Object.assign(result, { safe_key: value });
    }
  });

  return result;
}
