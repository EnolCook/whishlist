import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Le contrat de l'API est la source de vérité (R9) : les types de l'app doivent en être la copie exacte.
test("src/api/schema.d.ts is up to date with the API contract (npm run api:types)", () => {
  const root = join(__dirname, "../..");
  const out = join(mkdtempSync(join(tmpdir(), "schema-")), "schema.d.ts");
  execFileSync(
    process.execPath,
    [
      join(root, "node_modules/openapi-typescript/bin/cli.js"),
      join(root, "../specs/004-mobile-api/contracts/openapi.yaml"),
      "-o",
      out,
    ],
    { stdio: "ignore" },
  );
  expect(readFileSync(out, "utf8")).toBe(readFileSync(join(root, "src/api/schema.d.ts"), "utf8"));
});
