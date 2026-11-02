import type { TextInputProps } from "react-native";

import { Input } from "./Input";

/** Hauteur minimale de `components/ui/textarea.tsx` (`min-h-16`). */
const MIN_HEIGHT = 64;

/**
 * `components/ui/textarea.tsx` : le champ de saisie sur plusieurs lignes, qui grandit avec le texte
 * à partir de 64 de haut. Même bordure, même ombre et même focus que `Input`.
 */
export function Textarea({ style, ...props }: TextInputProps & { invalid?: boolean }) {
  return <Input {...props} multiline textAlignVertical="top" style={[{ minHeight: MIN_HEIGHT, paddingVertical: 8 }, style]} />;
}
