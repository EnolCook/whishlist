import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { tokens } from "@/theme/tokens";

import { AccordionChevron, AccordionContent, AccordionTrigger, useAccordion } from "./Accordion";
import { PressableShadow, Shadow } from "./Shadow";
import { Text } from "./Text";

const spacing = tokens.space[4];

/** `components/ui/card.tsx` : fond blanc, bordure, ombre, marges 16. Cliquable : s'enfonce à l'appui. */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  style,
  testID,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const boxStyle = [{ paddingVertical: spacing, gap: spacing }, style];
  if (!onPress) {
    return (
      <Shadow testID={testID} style={boxStyle}>
        {children}
      </Shadow>
    );
  }
  return (
    <PressableShadow
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      boxTestID={testID}
      boxStyle={boxStyle}
    >
      {children}
    </PressableShadow>
  );
}

/**
 * Carte repliable : l'accordéon du site (`components/ui/accordion.tsx`, voir `./Accordion`) dans
 * la boîte de `Card`. Seul l'en-tête est un bouton.
 */
export function CollapsibleCard({
  title,
  description,
  children,
  defaultExpanded = false,
  contentStyle,
  testID,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  /** Style du `CardContent` (une liste de liens alignés à gauche, par exemple). */
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { expanded, toggle, progress } = useAccordion(defaultExpanded);
  return (
    <Shadow testID={testID} style={{ paddingVertical: spacing }}>
      <AccordionTrigger expanded={expanded} onPress={toggle} label={title} testID={testID ? `${testID}-toggle` : undefined}>
        <CardHeader action={<AccordionChevron progress={progress} testID={testID ? `${testID}-chevron` : undefined} />}>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
      </AccordionTrigger>
      <AccordionContent
        expanded={expanded}
        progress={progress}
        testID={testID ? `${testID}-content` : undefined}
        style={{ paddingTop: spacing }}
      >
        <CardContent style={contentStyle}>{children}</CardContent>
      </AccordionContent>
    </Shadow>
  );
}

export function CardHeader({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={{ paddingHorizontal: spacing, flexDirection: "row", gap: spacing, alignItems: "flex-start" }}>
      <View style={{ flex: 1, gap: tokens.space[1] }}>{children}</View>
      {action}
    </View>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <Text weight="heading" accessibilityRole="header">
      {children}
    </Text>
  );
}

export function CardDescription({ children }: { children: ReactNode }) {
  return (
    <Text size="sm" color={tokens.colors.mutedForeground}>
      {children}
    </Text>
  );
}

export function CardContent({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ paddingHorizontal: spacing, gap: spacing }, style]}>{children}</View>;
}

export function CardFooter({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.space[2],
        padding: spacing,
        marginBottom: -spacing,
        borderTopWidth: tokens.borderWidth,
        borderTopColor: tokens.colors.black,
      }}
    >
      {children}
    </View>
  );
}
