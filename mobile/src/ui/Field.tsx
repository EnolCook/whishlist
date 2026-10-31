import type { ReactNode } from "react";
import { View } from "react-native";

import { tokens } from "@/theme/tokens";

import { Text } from "./Text";

/** `components/ui/field.tsx` : libellé au-dessus, aide grise, erreur dessous. */
export function Field({
  label,
  description,
  error,
  errorTestID,
  children,
}: {
  label?: string;
  description?: string;
  error?: string | null;
  errorTestID?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: tokens.space[2] }}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {error ? <FieldError testID={errorTestID}>{error}</FieldError> : null}
    </View>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text size="sm">{children}</Text>;
}

export function FieldDescription({ children }: { children: ReactNode }) {
  return (
    <Text size="sm" color={tokens.colors.mutedForeground}>
      {children}
    </Text>
  );
}

export function FieldError({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <Text size="sm" color={tokens.colors.destructive} accessibilityRole="alert" testID={testID}>
      {children}
    </Text>
  );
}
