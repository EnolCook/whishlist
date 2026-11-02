/** Lance `run` avec ces variables d'environnement (`undefined` : retirée), puis remet les valeurs d'avant. */
export async function withEnv<T>(values: Record<string, string | undefined>, run: () => T | Promise<T>): Promise<T> {
  const env = process.env as Record<string, string | undefined>;
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, env[key]]));
  const apply = (entries: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(entries)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  };
  apply(values);
  try {
    return await run();
  } finally {
    apply(previous);
  }
}
