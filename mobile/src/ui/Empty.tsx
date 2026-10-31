import type { ReactNode } from "react";
import { View } from "react-native";

import { tokens } from "@/theme/tokens";

import { Text } from "./Text";

/** `components/ui/empty.tsx` : illustration, texte centré, action ; sans carte. */
export function Empty({
  title,
  description,
  media,
  children,
  testID,
}: {
  title: string;
  description?: string;
  media?: ReactNode;
  children?: ReactNode;
  testID?: string;
}) {
  return (
    <View testID={testID} style={{ alignItems: "center", gap: tokens.space[2], paddingVertical: tokens.space[6] }}>
      {media ? <View style={{ marginBottom: tokens.space[2] }}>{media}</View> : null}
      <Text weight="heading" style={{ textAlign: "center" }}>
        {title}
      </Text>
      {description ? (
        <Text size="sm" color={tokens.colors.mutedForeground} style={{ textAlign: "center" }}>
          {description}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
