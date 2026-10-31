import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import type { Schemas } from "@/api/client";
import { cancelReservation } from "@/data/labels";
import { errorText } from "@/features/errors";
import { ListScreen } from "@/features/lists/ListScreen";
import { useOnline } from "@/network";
import { tokens } from "@/theme/tokens";
import { Alert } from "@/ui/Alert";
import { Button } from "@/ui/Button";
import { Card, CardContent } from "@/ui/Card";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { Empty } from "@/ui/Empty";
import { NetworkNote } from "@/ui/NetworkNote";
import { Text } from "@/ui/Text";

type Reservation = Schemas["MemberReservation"];

/**
 * Onglet Réservations, d'après `08-liste-reservations.png` : idée, offreur, petit mot.
 * Annuler est une action de membre qui exige le serveur ; hors ligne, lecture seule.
 */
export default function Reservations() {
  const { t } = useTranslation("list");
  const online = useOnline();
  const [toCancel, setToCancel] = useState<Reservation | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <ListScreen tab="reservations">
      {(list) => (
        <>
          <Text size="lg" accessibilityRole="header">
            {t("reservations.title")}
          </Text>
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          {list.reservations.length === 0 ? <Empty title={t("reservations.empty")} /> : null}
          {list.reservations.map((reservation) => (
            <Card key={reservation.id} testID={`reservations.item-${reservation.id}`}>
              <CardContent>
                <View style={{ gap: tokens.space[1] }}>
                  <Text weight="heading">{reservation.itemName}</Text>
                  {reservation.fromName ? (
                    <Text size="sm" color={tokens.colors.mutedForeground}>
                      {t("reservations.from", { name: reservation.fromName })}
                    </Text>
                  ) : null}
                </View>
                {reservation.note ? <Text testID={`reservations.note-${reservation.id}`}>{reservation.note}</Text> : null}
                <Button title={t("reservations.cancel")} variant="neutral" disabled={!online} onPress={() => setToCancel(reservation)} />
              </CardContent>
            </Card>
          ))}
          {list.reservations.length > 0 ? <NetworkNote /> : null}
          <ConfirmDialog
            visible={toCancel !== null}
            title={t("reservations.cancelTitle")}
            body={t("reservations.cancelBody")}
            confirmLabel={t("reservations.cancelConfirm")}
            keepLabel={t("reservations.cancelKeep")}
            onKeep={() => setToCancel(null)}
            onConfirm={() => {
              const reservation = toCancel;
              setToCancel(null);
              if (!reservation) return;
              setError(null);
              cancelReservation(list.id, reservation.id).catch((caught: unknown) => setError(errorText(caught)));
            }}
          />
        </>
      )}
    </ListScreen>
  );
}
