// Suffixe unique des comptes, listes et idées créés par un parcours (R6) : horodatage + aléa, en minuscules.
output.unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
