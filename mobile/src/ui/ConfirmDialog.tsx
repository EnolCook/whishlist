import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";

import { tokens } from "@/theme/tokens";

import { Button } from "./Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./Card";

/** Boîte de dialogue modale centrée sur fond assombri ; avec des champs, elle reste visible au-dessus du clavier. */
export function ModalCard({
  visible,
  title,
  description,
  dismissLabel,
  onDismiss,
  children,
}: {
  visible: boolean;
  title: string;
  description?: string;
  dismissLabel: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      {/* Avec des champs (réservation), le clavier ne doit pas couvrir la carte : elle remonte (iOS) et défile. */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: tokens.space[4] }}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dismissLabel}
            onPress={onDismiss}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View accessibilityViewIsModal>
            <Card>
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description ? <CardDescription>{description}</CardDescription> : null}
              </CardHeader>
              <CardContent>{children}</CardContent>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Confirmation au style du site (`components/site/confirm-form.tsx`) : titre, texte, action et « Conserver ». */
export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  keepLabel,
  destructive = true,
  onConfirm,
  onKeep,
  testID,
}: {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  keepLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onKeep: () => void;
  /** Sur le bouton de l'action ; `<testID>-keep` sur « Conserver ». */
  testID?: string;
}) {
  return (
    <ModalCard visible={visible} title={title} description={body} dismissLabel={keepLabel} onDismiss={onKeep}>
      <Button title={confirmLabel} variant={destructive ? "destructive" : "default"} fullWidth onPress={onConfirm} testID={testID} />
      <Button title={keepLabel} variant="neutral" fullWidth onPress={onKeep} testID={testID ? `${testID}-keep` : undefined} />
    </ModalCard>
  );
}
