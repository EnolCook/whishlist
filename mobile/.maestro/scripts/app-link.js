// Adresse du site (URL) → même chemin au schéma de l'app (output.appLink), pour l'ouvrir dans l'app :
// en local, le domaine n'est pas associé à l'app, et un lien http ouvrirait le navigateur (011).
const match = URL.match(/^https?:\/\/[^/]+\/(.*)$/);
if (!match) throw new Error("Adresse du site attendue : " + URL);
output.appLink = "ohyoushouldnt://" + match[1];
