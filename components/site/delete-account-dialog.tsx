"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AccountDeletionPreview } from "@/src/domain/account";
import { deleteAccountAction } from "@/src/server/actions";

/** Titres affichés par groupe ; au-delà, « et N de plus ». */
const SHOWN = 5;

function Titles({ titles }: { titles: string[] }) {
  const { t } = useTranslation("auth");
  const rest = titles.length - SHOWN;
  return (
    <ul className="list-disc pl-5">
      {titles.slice(0, SHOWN).map((title, index) => (
        <li key={index}>{title}</li>
      ))}
      {rest > 0 ? <li>{t("account.deleteMore", { count: rest })}</li> : null}
    </ul>
  );
}

/** Confirmation de la suppression du compte : ce qui part, ce qui reste, puis le mot de passe. */
export function DeleteAccountDialog({ preview }: { preview: AccountDeletionPreview }) {
  const { t } = useTranslation("auth");
  const { deletedLists, transferredLists, reservationsKept, followedLists } = preview;
  const keptNothing = transferredLists.length === 0 && reservationsKept === 0;

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="destructive" className="w-full" />}>
        {t("account.deleteAction")}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("account.deleteTitle")}</DialogTitle>
          <DialogDescription className="font-bold text-foreground">{t("account.deleteWarning")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 text-sm">
          <section className="flex flex-col gap-1">
            <h3 className="font-bold">{t("account.deleteRemoved")}</h3>
            <p>{t("account.deleteRemovedAccount")}</p>
            {deletedLists.length > 0 ? (
              <>
                <p>{t("account.deleteRemovedLists", { count: deletedLists.length })}</p>
                <Titles titles={deletedLists.map((list) => list.title)} />
              </>
            ) : null}
            {followedLists.length > 0 ? (
              <>
                <p>{t("account.deleteRemovedFollowed", { count: followedLists.length })}</p>
                <Titles titles={followedLists.map((list) => list.title)} />
              </>
            ) : null}
          </section>
          <section className="flex flex-col gap-1">
            <h3 className="font-bold">{t("account.deleteKept")}</h3>
            {keptNothing ? <p>{t("account.deleteKeptNone")}</p> : null}
            {transferredLists.length > 0 ? (
              <>
                <p>{t("account.deleteKeptLists", { count: transferredLists.length })}</p>
                <Titles
                  titles={transferredLists.map((list) =>
                    list.newOwnerName
                      ? t("account.deleteNewOwner", { title: list.title, name: list.newOwnerName })
                      : list.title,
                  )}
                />
              </>
            ) : null}
            {reservationsKept > 0 ? (
              <p>{t("account.deleteKeptReservations", { count: reservationsKept })}</p>
            ) : null}
          </section>
        </div>
        <form action={deleteAccountAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="delete-password">{t("account.deletePassword")}</FieldLabel>
              <Input id="delete-password" name="password" type="password" required autoComplete="current-password" />
            </Field>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>{t("account.deleteCancel")}</DialogClose>
              <Button type="submit" variant="destructive">
                {t("account.deleteConfirm")}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
