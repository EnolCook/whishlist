// Processus séparé pour les tests : ouvre la base de `argv[2]` (même chemin que WISHLIST_DATA_PATH)
// et affiche le nombre de comptes et de marqueurs d'import.
import { openStore } from "../../../src/store/connection";

const store = openStore(process.argv[2]);
const users = (store.reader.prepare("select count(*) as n from users").get() as { n: number }).n;
const markers = (store.reader.prepare("select count(*) as n from meta where key = 'legacy_import'").get() as { n: number }).n;
process.stdout.write(JSON.stringify({ users, markers }));
