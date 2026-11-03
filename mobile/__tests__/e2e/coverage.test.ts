import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { readFlowHeader } from "../../scripts/e2e/flows.cjs";

const repo = join(__dirname, "../../..");
const flowsDir = join(repo, "mobile/.maestro/flows");
const specs = {
  "005": "specs/005-mobile-list-app/spec.md",
  "006": "specs/006-mobile-legal-account/spec.md",
  "009": "specs/009-account-cards-expand/spec.md",
  "010": "specs/010-email-verification-change/spec.md",
  "011": "specs/011-app-deep-links/spec.md",
  "012": "specs/012-list-subscriptions/spec.md",
};

function storiesOf(feature: string, file: string): string[] {
  const text = readFileSync(join(repo, file), "utf8");
  return [...text.matchAll(/^### User Story (\d+)\b/gm)].map((match) => `${feature}-us${match[1]}`);
}

/** Tags de l'en-tête d'un parcours, lus comme le runner les lit. */
function tagsOf(file: string): string[] {
  return readFlowHeader(join(flowsDir, file)).tags;
}

const flows = readdirSync(flowsDir).filter((file) => file.endsWith(".yaml"));
const storyTag = /^\d{3}-us\d+$/;

test("every flow has exactly one story tag", () => {
  const wrong = flows.filter((file) => tagsOf(file).filter((tag) => storyTag.test(tag)).length !== 1);
  expect(wrong).toEqual([]);
});

test("every line of exclusions.md gives a reason and links to a quickstart section", () => {
  const rows = readFileSync(join(repo, "mobile/.maestro/exclusions.md"), "utf8")
    .split("\n")
    .filter((line) => /^\|\s*\d{3}-us\d+/.test(line))
    .map((line) => line.split("|").map((cell) => cell.trim()));
  expect(rows.length).toBeGreaterThan(5);
  const wrong = rows.filter((cells) => !cells[3] || !/quickstart\.md#/.test(cells[4] ?? ""));
  expect(wrong.map((cells) => `${cells[1]} — ${cells[2]}`)).toEqual([]);
});

test("every story of the mobile features has a flow, or is listed as a whole story in exclusions.md", () => {
  const covered = new Set(flows.flatMap(tagsOf));
  const exclusions = readFileSync(join(repo, "mobile/.maestro/exclusions.md"), "utf8");
  const wholeStories = new Set(
    exclusions
      .split("\n")
      .map((line) => line.split("|").map((cell) => cell.trim()))
      .filter((cells) => cells.length > 3 && /story entière/i.test(cells[2] ?? ""))
      .map((cells) => cells[1]),
  );
  const stories = Object.entries(specs).flatMap(([feature, file]) => storiesOf(feature, file));
  expect(stories.length).toBeGreaterThanOrEqual(12);
  expect(stories.filter((story) => !covered.has(story) && !wholeStories.has(story))).toEqual([]);
});
