"use client";

import { Smartphone } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Locale } from "@/src/i18n/config";
import { phonePlatform, type PhonePlatform } from "@/src/site/device";

/** La plateforme ne change pas pendant la visite : rien à écouter. */
function subscribe(): () => void {
  return () => undefined;
}

function readPlatform(): PhonePlatform | null {
  const data = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  return phonePlatform(navigator.userAgent, data?.mobile);
}

type Badge = { platform: PhonePlatform; href: string; src: string; alt: string; className: string };

/**
 * Icône « l'app sur votre téléphone » de l'en-tête (011, US3), seulement sur un téléphone et si une fiche
 * de store est réglée. Elle sonne 5 fois une seconde à l'affichage (animation CSS bornée, `phone-ring`),
 * s'arrête dès qu'on la touche, et ouvre la fenêtre des badges, celui du téléphone en premier.
 */
export function GetAppButton(props: { appStoreUrl: string | null; playStoreUrl: string | null; locale: Locale }) {
  // Le layout reste monté d'une page à l'autre : la clé remonte le bouton, qui sonne à chaque page affichée.
  return <PhoneButton key={usePathname()} {...props} />;
}

function PhoneButton({
  appStoreUrl,
  playStoreUrl,
  locale,
}: {
  appStoreUrl: string | null;
  playStoreUrl: string | null;
  locale: Locale;
}) {
  const { t } = useTranslation("common");
  // Côté serveur, et au premier rendu, l'appareil est inconnu : rien n'est rendu.
  const platform = useSyncExternalStore(subscribe, readPlatform, () => null);
  const [ringing, setRinging] = useState(true);
  if (!platform || (!appStoreUrl && !playStoreUrl)) return null;

  const badges: Badge[] = [];
  if (appStoreUrl) {
    badges.push({
      platform: "ios",
      href: appStoreUrl,
      src: `/badges/${locale}/app-store.svg`,
      alt: t("getApp.appStore"),
      className: "h-12",
    });
  }
  if (playStoreUrl) {
    // Le PNG de Google a une marge transparente : plus haut pour paraître de la taille du badge Apple.
    badges.push({
      platform: "android",
      href: playStoreUrl,
      src: `/badges/${locale}/google-play.png`,
      alt: t("getApp.googlePlay"),
      className: "h-[4.5rem] -my-3",
    });
  }
  badges.sort((a, b) => Number(b.platform === platform) - Number(a.platform === platform));

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="neutral"
            size="icon-sm"
            aria-label={t("getApp.button")}
            onClick={() => setRinging(false)}
          />
        }
      >
        <Smartphone aria-hidden className={cn(ringing && "phone-ring")} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("getApp.title")}</DialogTitle>
          <DialogDescription>{t("getApp.description")}</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col items-center gap-4 py-2">
          {badges.map((badge) => (
            <li key={badge.platform}>
              <a href={badge.href} target="_blank" rel="noopener" className="block">
                {/* Badges officiels, servis tels quels (public/badges/README.md). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={badge.src} alt={badge.alt} className={cn("w-auto", badge.className)} />
              </a>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{t("getApp.trademarks")}</p>
      </DialogContent>
    </Dialog>
  );
}
