import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const mobile = join(__dirname, "../..");

function files(dir: string, extension: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => join(entry.parentPath, entry.name));
}

/** testID du code : littéraux (`testID="a"`, `testID={"a"}`) et préfixes des identifiants dynamiques (`` `a-${x}` ``). */
function declaredIds() {
  const literals = new Set<string>();
  const prefixes = new Set<string>();
  for (const file of [...files(join(mobile, "app"), ".tsx"), ...files(join(mobile, "src"), ".tsx")]) {
    const source = readFileSync(file, "utf8");
    // `testID`, et les props qui le transmettent à un élément interne (`errorTestID` de `Field`).
    for (const match of source.matchAll(/\b(?:testID|[a-z]\w*TestID)=(?:"([^"]+)"|\{\s*"([^"]+)"\s*\}|\{\s*`([^`]+)`\s*\})/g)) {
      const template = match[3];
      if (template === undefined) literals.add(match[1] ?? match[2]);
      else if (!template.startsWith("${")) prefixes.add(template.split("${")[0]);
    }
  }
  return { literals, prefixes };
}

/** `id:` des parcours et sous-parcours, avec leur fichier. */
function usedIds() {
  const used: { id: string; file: string }[] = [];
  for (const dir of ["flows", "subflows"]) {
    for (const file of files(join(mobile, ".maestro", dir), ".yaml")) {
      for (const match of readFileSync(file, "utf8").matchAll(/^\s*id:\s*["']?([^"'\s#]+)/gm)) {
        // Un `id:` est une regex : on retire ses échappements (`lists\\.card-…`) avant de le comparer.
        used.push({ id: match[1].replace(/\\/g, ""), file: relative(mobile, file) });
      }
    }
  }
  return used;
}

// Éléments du système (feuille de partage iOS) et du dev client (menu développeur), absents du code de l'app.
const systemIds = new Set(["ShareSheet.RemoteContainerView", "PopoverDismissRegion", "xmark"]);

test("every id: used by a flow is a testID of the app", () => {
  const { literals, prefixes } = declaredIds();
  const known = (id: string) =>
    systemIds.has(id) ||
    // Identifiants d'Android (`<paquet>:id/<nom>`), propres au système.
    id.includes(":id/") ||
    literals.has(id) ||
    // `Button` pose `<testID>-box` sur sa boîte, `ConfirmDialog` `<testID>-keep` sur « Conserver »,
    // `CollapsibleCard` `<testID>-toggle` sur son en-tête, `-chevron` sur l'indicateur et `-content` sur son contenu,
    // `PasswordForm` `<testID>-current`, `-next`, `-confirm` et `-submit` sur ses champs et son bouton.
    ["-box", "-keep", "-toggle", "-chevron", "-content", "-current", "-next", "-confirm", "-submit"].some((suffix) => id.endsWith(suffix) && literals.has(id.slice(0, -suffix.length))) ||
    [...prefixes].some((prefix) => id.startsWith(prefix) && id.length > prefix.length);
  const used = usedIds();
  expect(used.length).toBeGreaterThan(20);
  expect(used.filter(({ id }) => !known(id))).toEqual([]);
});

test("no testID holds an e-mail address or a space", () => {
  const { literals, prefixes } = declaredIds();
  expect([...literals, ...prefixes].filter((id) => /[@\s]/.test(id))).toEqual([]);
});
