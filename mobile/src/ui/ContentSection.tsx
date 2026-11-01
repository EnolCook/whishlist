import type { ReactNode } from "react";
import { View } from "react-native";

import { tokens } from "@/theme/tokens";

import { AccordionChevron, AccordionContent, AccordionTrigger, useAccordion } from "./Accordion";
import { Shadow } from "./Shadow";
import { Text } from "./Text";

const boxStyle = { backgroundColor: tokens.colors.white, padding: tokens.space[5], gap: tokens.space[3] };

/** Section de `components/site/content-page.tsx` : carte blanche à bordure et ombre, titre, texte gris. */
export function ContentSection({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Shadow style={boxStyle}>
      <Text size="2xl" weight="heading" accessibilityRole="header">
        {title}
      </Text>
      {children ? <View style={{ gap: tokens.space[3] }}>{children}</View> : null}
    </Shadow>
  );
}

/**
 * Section repliable (licences) : le titre et `summary` restent visibles, le titre se touche pour
 * déplier `children` avec l'animation de `./Accordion`. `children` n'est monté que déplié (texte long).
 */
export function CollapsibleContentSection({
  title,
  summary,
  children,
  testID,
}: {
  title: string;
  summary?: ReactNode;
  children: ReactNode;
  testID?: string;
}) {
  const { expanded, shown, toggle, progress } = useAccordion();
  return (
    <Shadow style={boxStyle}>
      <AccordionTrigger
        expanded={expanded}
        onPress={toggle}
        testID={testID ? `${testID}-toggle` : undefined}
        style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[3] }}
      >
        <Text size="2xl" weight="heading" accessibilityRole="header" style={{ flexShrink: 1 }}>
          {title}
        </Text>
        <AccordionChevron progress={progress} testID={testID ? `${testID}-chevron` : undefined} />
      </AccordionTrigger>
      {summary ? <View style={{ gap: tokens.space[3] }}>{summary}</View> : null}
      <AccordionContent
        expanded={expanded}
        progress={progress}
        mounted={shown}
        testID={testID ? `${testID}-content` : undefined}
        style={{ gap: tokens.space[3] }}
      >
        {children}
      </AccordionContent>
    </Shadow>
  );
}

/** Paragraphe d'une section : gris, interligne large (`leading-7`). */
export function ContentText({ children }: { children: ReactNode }) {
  return (
    <Text color={tokens.colors.mutedForeground} style={{ lineHeight: tokens.lineHeight.relaxed }}>
      {children}
    </Text>
  );
}
