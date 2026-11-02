import { androidAssociationResponse } from "@/src/site/app-links-config";

/** App Links Android (feature 011) : lu à chaque requête, la variable peut changer sans rebuild. */
export const dynamic = "force-dynamic";

export function GET() {
  return androidAssociationResponse();
}
