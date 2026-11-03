import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const insetPanelClasses = "rounded-base border-2 border-border bg-secondary-background p-3 shadow-shadow";

/**
 * Encadré d'une ligne à l'intérieur d'une carte (une offre, une clé d'API) : bordure, fond et ombre de la
 * carte, avec un padding plus serré. La mise en page (flex, gap) reste à l'appelant.
 */
export function InsetPanel({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(insetPanelClasses, className)} {...props} />;
}

/** Même encadré, en élément de liste (`<li>`). */
export function InsetPanelItem({ className, ...props }: ComponentProps<"li">) {
  return <li className={cn(insetPanelClasses, className)} {...props} />;
}
