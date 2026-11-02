import { ExternalLinkIcon } from "lucide-react";
import type { PublicItem } from "@/src/domain/read";
import { cancelMyReservationAction } from "@/src/server/actions";
import { ConfirmForm } from "@/components/site/confirm-form";
import { LinkButton } from "@/components/site/link-button";
import { PriorityStars } from "@/components/site/priority-stars";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function PublicItemCard({
  item,
  readToken,
  buyLink,
  buyLinkAria,
  offerLabel,
  offerAria,
  mineLabel,
  secondHandLabel,
  cancelLabel,
  cancelTitle,
  cancelDescription,
  cancelConfirm,
  cancelKeep,
}: {
  item: PublicItem;
  readToken: string;
  buyLink: string;
  buyLinkAria: string;
  offerLabel: string;
  offerAria: string;
  mineLabel: string;
  secondHandLabel: string;
  cancelLabel: string;
  cancelTitle: string;
  cancelDescription: string;
  cancelConfirm: string;
  cancelKeep: string;
}) {
  return (
    <Card size="sm" className={item.mine ? "opacity-95" : undefined}>
      <CardHeader>
        <div className="flex items-start gap-3">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt={item.name}
              className="size-20 shrink-0 rounded-base border-2 border-border object-cover shadow-shadow"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <CardTitle className="text-balance">{item.name}</CardTitle>
                <PriorityStars value={item.priority} />
              </div>
              {item.priceLabel ? (
                <p className="shrink-0 text-2xl leading-none font-bold tabular-nums">{item.priceLabel}</p>
              ) : null}
            </div>
            {item.description ? (
              <p className="text-sm break-words whitespace-pre-line text-pretty">{item.description}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <CardDescription className="flex flex-wrap gap-2">
                <Badge variant="outline">{item.personLabel}</Badge>
                {item.secondHandOk ? <Badge variant="outline">{secondHandLabel}</Badge> : null}
                {item.mine ? <Badge variant="secondary">{mineLabel}</Badge> : null}
              </CardDescription>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={buyLinkAria}
                  className="ml-auto inline-flex items-center gap-1 text-xs leading-none underline underline-offset-2"
                >
                  <ExternalLinkIcon className="size-3" aria-hidden />
                  {buyLink}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardFooter className="border-t-2 border-border pt-3">
        {item.mine && item.reservationId ? (
          <ConfirmForm
            title={cancelTitle}
            description={cancelDescription}
            confirmLabel={cancelConfirm}
            cancelLabel={cancelKeep}
            action={cancelMyReservationAction}
            fields={{ readToken, reservationId: item.reservationId }}
            triggerLabel={cancelLabel}
            triggerVariant="outline"
            triggerSize="sm"
            confirmVariant="destructive"
          />
        ) : (
          <LinkButton
            href={`/l/${readToken}/reserver?itemId=${encodeURIComponent(item.id)}`}
            size="sm"
            className="w-full sm:w-auto"
            aria-label={offerAria}
          >
            {offerLabel}
          </LinkButton>
        )}
      </CardFooter>
    </Card>
  );
}
