import { Alert, AlertDescription } from "@/components/ui/alert";
import { isSiteLink } from "@/src/site/dev-link";

/**
 * Lien d'un e-mail qui n'est pas parti (dev, envoi simulé), lu dans l'URL de la page.
 * Jamais affiché en production (la commande ne le rend pas), et seulement vers une page de ce site
 * (`origin`, chemin qui commence par `page`) : un lien glissé dans l'URL n'est pas montré.
 */
export function DevLinkAlert({
  label,
  url,
  origin,
  page,
}: {
  label: string;
  url: string | null | undefined;
  origin: string;
  page: "/confirmer-email/" | "/reinitialiser/";
}) {
  if (process.env.NODE_ENV === "production" || !isSiteLink(url, origin, page)) return null;
  return (
    <Alert>
      <AlertDescription className="flex flex-col gap-2">
        <span>{label}</span>
        <a href={url} className="break-all underline underline-offset-2">
          {url}
        </a>
      </AlertDescription>
    </Alert>
  );
}
