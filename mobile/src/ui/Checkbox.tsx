import { CheckIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { useTheme } from "@/theme/ListTheme";
import { tokens } from "@/theme/tokens";

import { Shadow } from "./Shadow";
import { Text } from "./Text";

const BOX = 20;

/**
 * `components/ui/checkbox.tsx` : case de 20, bordure, ombre, couleur principale et coche blanche
 * une fois cochée. Toute la ligne (case et libellé) se touche, à la hauteur minimale d'une cible.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  description,
  testID,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  testID?: string;
}) {
  const palette = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      accessibilityHint={description}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: tokens.space[2], minHeight: tokens.touchTarget }}
    >
      <View style={{ paddingTop: 2 }}>
        <Shadow
          testID={testID ? `${testID}-box` : undefined}
          style={{
            width: BOX,
            height: BOX,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: checked ? palette.main : tokens.colors.white,
          }}
        >
          {checked ? <CheckIcon size={14} color={tokens.colors.white} strokeWidth={3} /> : null}
        </Shadow>
      </View>
      <View style={{ flex: 1, gap: tokens.space[1] }}>
        <Text>{label}</Text>
        {description ? (
          <Text size="sm" color={tokens.colors.mutedForeground}>
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
