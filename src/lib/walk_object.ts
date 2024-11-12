export function walk_object(
  obj: Record<string, unknown>,
  predicate: (value: unknown) => boolean,
  path: string[] = [],
  paths: Set<string>,
): void {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const currentPath = [...path, key];

      // Check the predicate
      if (predicate(value)) {
        paths.add(currentPath.join("."));
        // console.log("Path:", currentPath.join("."));
      }

      // Recurse if the value is an object
      if (typeof value === "object" && value !== null) {
        walk_object(
          value as Record<string, unknown>,
          predicate,
          currentPath,
          paths,
        );
      }
    }
  }
}
