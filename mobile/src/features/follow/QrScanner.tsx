import { CameraView } from "expo-camera";
import { useRef } from "react";

import { tokens } from "@/theme/tokens";
import { Shadow } from "@/ui/Shadow";

/** Délai avant de relire le même code : la caméra le renvoie plusieurs fois par seconde. */
const SAME_CODE_DELAY_MS = 2000;

/**
 * Viseur carré qui lit les QR codes seulement (012, US4), dans une boîte au style du site comme `QrCard`.
 * La permission caméra est demandée par l'écran avant d'afficher le viseur.
 */
export function QrScanner({ onScanned, testID }: { onScanned: (data: string) => void; testID?: string }) {
  const last = useRef<{ data: string; at: number } | null>(null);
  return (
    <Shadow style={{ overflow: "hidden" }}>
      <CameraView
        testID={testID}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => {
          const now = Date.now();
          if (last.current?.data === data && now - last.current.at < SAME_CODE_DELAY_MS) return;
          last.current = { data, at: now };
          onScanned(data);
        }}
        style={{ width: "100%", aspectRatio: 1, borderRadius: tokens.radius }}
      />
    </Shadow>
  );
}
