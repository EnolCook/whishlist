// Dernier lien envoyé à TO, lu dans MailDev (MAILDEV_URL, passé par la commande e2e).
// KIND choisit la page du lien : confirmer-email (par défaut), reinitialiser ou inviter.
// Rend output.link (et output.confirmUrl, nom gardé pour les parcours de la 010) ;
// échoue si aucun e-mail n'est encore arrivé (l'appelant réessaie).
const kind = typeof KIND === "undefined" || !KIND ? "confirmer-email" : KIND;
const pattern = new RegExp("https?:\\/\\/\\S+\\/" + kind + "\\/[\\w-]+(\\?\\S*)?");
const response = http.get(MAILDEV_URL + "/api/email");
const emails = json(response.body).filter((email) =>
  email.to.some((recipient) => recipient.address.toLowerCase() === TO.toLowerCase()),
);
const links = emails.map((email) => (email.text.match(pattern) || [])[0]).filter((link) => link);
if (links.length === 0) throw new Error("Aucun lien " + kind + " pour " + TO + " dans MailDev");
output.link = links[links.length - 1];
output.confirmUrl = output.link;
output.confirmLinks = links.length;
