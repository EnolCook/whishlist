import { Modal, Pressable, View } from "react-native";

import { tokens } from "@/theme/tokens";

import { Button } from "./Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./Card";

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeep}>
      <View style={{ flex: 1, justifyContent: "center", padding: tokens.space[4] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={keepLabel}
          onPress={onKeep}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)" }}
        />
        <View accessibilityViewIsModal>
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              {body ? <CardDescription>{body}</CardDescription> : null}
            </CardHeader>
            <CardContent>
              <Button title={confirmLabel} variant={destructive ? "destructive" : "default"} fullWidth onPress={onConfirm} testID={testID} />
              <Button title={keepLabel} variant="neutral" fullWidth onPress={onKeep} testID={testID ? `${testID}-keep` : undefined} />
            </CardContent>
          </Card>
        </View>
      </View>
    </Modal>
  );
}
