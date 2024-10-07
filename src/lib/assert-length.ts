export function assert_one<T>(value: T[]): asserts value is [T] {
  if (value.length !== 1) {
    throw new Error(`Expected exactly one item, got ${value.length}`);
  }
}

export function assert_at_most_one<T>(value: T[]): asserts value is [T] | [] {
  if (value.length > 1) {
    throw new Error(`Expected at most one item, got ${value.length}`);
  }
}
