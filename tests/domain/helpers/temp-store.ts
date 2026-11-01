import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { closeStore } from "../../../src/store/db";

/** Lance `run` avec `WISHLIST_DATA_PATH` dans un dossier temporaire (base `.db` à côté), puis ferme et supprime. */
export async function withTempDataPath(run: (dataPath: string, dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(tmpdir(), "wl-store-"));
  const dataPath = path.join(dir, "wishlist.json");
  const previous = process.env.WISHLIST_DATA_PATH;
  process.env.WISHLIST_DATA_PATH = dataPath;
  try {
    await run(dataPath, dir);
  } finally {
    closeStore(dataPath);
    if (previous === undefined) delete process.env.WISHLIST_DATA_PATH;
    else process.env.WISHLIST_DATA_PATH = previous;
    await rm(dir, { recursive: true, force: true });
  }
}
