import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import Database from "better-sqlite3";
import { readDatabaseFile } from "../../src/store/connection";
import { updateDocument } from "../../src/store/db";
import { checkDocument } from "../../src/store/legacy-json";
import { apiDoc, withStore } from "./helpers/api-fixtures";

const run = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "..", "..");

test("sauvegarde à chaud pendant des écritures : copie intègre et cohérente", async () => {
  await withStore(apiDoc(), async () => {
    const dataPath = process.env.WISHLIST_DATA_PATH!;
    const destination = path.join(path.dirname(dataPath), "backup.db");
    let writing = true;
    let written = 0;
    const writes = (async () => {
      while (writing) {
        await updateDocument((doc) => {
          doc.items.push({ ...doc.items[0], id: `bk-${written}`, sortOrder: 10 + written });
          return { doc, result: null };
        });
        written++;
        // Rend la main à la boucle d'événements, sinon la fin du processus de sauvegarde n'est jamais lue.
        await new Promise((resolve) => setImmediate(resolve));
      }
    })();
    const before = written;
    const { stdout } = await run(process.execPath, [path.join(repoRoot, "scripts", "db-backup.mjs"), destination], {
      cwd: repoRoot,
      env: { ...process.env, WISHLIST_DATA_PATH: dataPath },
    });
    const during = written - before;
    writing = false;
    await writes;
    assert.match(stdout, /backup\.db \(\d+ octets\)/);
    assert.ok(during > 0, "aucune écriture pendant la sauvegarde");

    const copy = new Database(destination, { readonly: true });
    try {
      assert.equal(copy.pragma("integrity_check", { simple: true }), "ok");
    } finally {
      copy.close();
    }
    const doc = readDatabaseFile(destination);
    assert.deepEqual(checkDocument(doc), []);
    assert.equal(doc.users.length, 2);
  });
});
