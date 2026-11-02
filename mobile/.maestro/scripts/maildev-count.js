// Nombre d'e-mails reçus par TO dans MailDev (MAILDEV_URL) : rend output.inboxCount.
const response = http.get(MAILDEV_URL + "/api/email");
output.inboxCount = json(response.body).filter((email) =>
  email.to.some((recipient) => recipient.address.toLowerCase() === TO.toLowerCase()),
).length;
