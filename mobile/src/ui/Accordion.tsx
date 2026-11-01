import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Animated, Easing, Keyboard, Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import { useReduceMotion } from "@/theme/motion";
import { tokens } from "@/theme/tokens";

/**
 * Mécanique de `components/ui/accordion.tsx` : état ouvert, valeur animée (0 replié, 1 déplié),
 * 200 ms, sans animation si l'appareil demande de les réduire. Replier ferme le clavier.
 * `shown` : le contenu est à l'écran (déplié, ou en train de se replier) ; il passe à `false`
 * une fois le repli fini, pour ne monter un contenu lourd que s'il sert (voir `AccordionContent`).
 * L'en-tête : `AccordionTrigger`.
 */
export function useAccordion(defaultExpanded = false) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [shown, setShown] = useState(defaultExpanded);
  const [progress] = useState(() => new Animated.Value(defaultExpanded ? 1 : 0));
  const reduceMotion = useReduceMotion();

  function toggle() {
    const next = !expanded;
    if (!next) Keyboard.dismiss();
    setExpanded(next);
    if (next) setShown(true);
    const toValue = next ? 1 : 0;
    if (reduceMotion) {
      progress.setValue(toValue);
      if (!next) setShown(false);
      return;
    }
    Animated.timing(progress, { toValue, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: false }).start(
      // Un repli interrompu par un nouvel appui (`finished: false`) garde le contenu.
      ({ finished }) => {
        if (finished && !next) setShown(false);
      },
    );
  }

  return { expanded, shown, toggle, progress };
}

/**
 * En-tête cliquable : bouton qui annonce son état (déplié ou non) et ce que fait l'appui.
 * Sa mise en page (titre, compteur, chevron) reste à l'appelant.
 */
export function AccordionTrigger({
  expanded,
  onPress,
  label,
  style,
  testID,
  children,
}: {
  expanded: boolean;
  onPress: () => void;
  /** Nom lu par les lecteurs d'écran, quand le contenu de l'en-tête n'y suffit pas. */
  label?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation("mobile");
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={label}
      accessibilityHint={expanded ? t("collapsible.collapse") : t("collapsible.expand")}
      style={style}
    >
      {children}
    </Pressable>
  );
}

/** Chevron vers le bas qui pivote vers le haut quand le contenu est déplié. */
export function AccordionChevron({
  progress,
  color = tokens.colors.mutedForeground,
  testID,
}: {
  progress: Animated.Value;
  color?: string;
  testID?: string;
}) {
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  return (
    <Animated.View testID={testID} style={{ transform: [{ rotate }] }}>
      <ChevronDownIcon size={16} color={color} />
    </Animated.View>
  );
}

/**
 * Contenu repliable, caché aux lecteurs d'écran et aux appuis quand il est replié. Monté par défaut
 * (la saisie d'un formulaire survit à un repli) ; `mounted={shown}` ne le monte que déplié (une
 * liste d'idées, un texte de licence). Sa hauteur naturelle est mesurée (`<testID>-measure`) hors
 * de la hauteur animée, et suivie quand elle change (une alerte qui apparaît, une idée ajoutée).
 */
export function AccordionContent({
  expanded,
  progress,
  children,
  mounted = true,
  style,
  testID,
}: {
  expanded: boolean;
  progress: Animated.Value;
  children: ReactNode;
  /** `false` : contenu retiré (le `shown` de `useAccordion`, pour un contenu lourd). */
  mounted?: boolean;
  /** Style de la vue mesurée (marges internes, espacement). */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const [height, setHeight] = useState(0);
  return (
    <Animated.View
      testID={testID}
      accessibilityElementsHidden={!expanded}
      importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
      pointerEvents={expanded ? "auto" : "none"}
      style={{
        overflow: "hidden",
        height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, height] }),
        opacity: progress,
      }}
    >
      <View
        testID={testID ? `${testID}-measure` : undefined}
        style={[{ position: "absolute", top: 0, left: 0, right: 0 }, style]}
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      >
        {mounted ? children : null}
      </View>
    </Animated.View>
  );
}
