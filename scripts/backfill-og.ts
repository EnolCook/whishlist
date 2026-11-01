import { fetchOgImage } from "../src/domain/og-image";
import { closeStore, readDocument, updateDocument } from "../src/store/db";

async function main() {
  const doc = await readDocument();
  const targets = doc.items.filter((item) => item.url && !item.imageUrl);
  console.log(`targets ${targets.length} / ${doc.items.length}`);

  // Les pages produit se téléchargent hors transaction : la base reste libre pendant ce temps.
  const found = new Map<string, string>();
  let fail = 0;
  for (const item of targets) {
    const img = await fetchOgImage(item.url!);
    if (img) {
      found.set(item.id, img);
      console.log("OK", item.name.slice(0, 48), "→", img.slice(0, 90));
    } else {
      fail++;
      console.log("NO", item.name.slice(0, 48), item.url!.slice(0, 90));
    }
  }

  // Une seule écriture ; une image ajoutée entre-temps par l'app n'est pas écrasée.
  const ok = await updateDocument((current) => {
    let saved = 0;
    for (const item of current.items) {
      const img = found.get(item.id);
      if (img && !item.imageUrl) {
        item.imageUrl = img;
        saved++;
      }
    }
    return { doc: current, result: saved };
  });
  console.log(`done ok=${ok} fail=${fail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeStore());
