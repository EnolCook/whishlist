// Dernier lien de confirmation envoyé à TO, lu dans MailDev (MAILDEV_URL, passé par la commande e2e).
// Rend output.confirmUrl ; échoue si aucun e-mail n'est encore arrivé (l'appelant réessaie).
const response = http.get(MAILDEV_URL + "/api/email");
const emails = json(response.body).filter((email) =>
  email.to.some((recipient) => recipient.address.toLowerCase() === TO.toLowerCase()),
);
const links = emails
  .map((email) => (email.text.match(/https?:\/\/\S+\/confirmer-email\/[\w-]+(\?\S*)?/) || [])[0])
  .filter((link) => link);
if (links.length === 0) throw new Error("Aucun lien de confirmation pour " + TO + " dans MailDev");
output.confirmUrl = links[links.length - 1];
output.confirmLinks = links.length;
