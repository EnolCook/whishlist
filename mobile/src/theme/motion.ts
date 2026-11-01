import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Réglage « réduire les animations » du téléphone, suivi en direct. `null` tant que le système
 * n'a pas répondu : une animation qui démarre seule attend la réponse avant de se lancer.
 */
export function useReduceMotion(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
