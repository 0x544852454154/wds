import type { Metadata, Viewport } from "next";

import { Site } from "@/components/Site";
import { BG_ART, BL_ART, BRAILLE_GLYPHS, ENTER_ART } from "@/lib/art";
import { publicGroups, publicFallbackOf, publicRoleOf, MEMBER_IDS } from "@/lib/member-table.server";
import { fetchPresence } from "@/lib/presence.server";

export const metadata: Metadata = {
  title: "@ world domination$",
  description: "exclusive, @wd$",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default async function Page() {
  // Server-rendered presence snapshot. The snapshot is keyed by anonymous
  // index, so no snowflake ID crosses into the HTML or the RSC payload.
  const seed = await fetchPresence(MEMBER_IDS);

  const groups = publicGroups();
  const roleOf: Record<number, string> = {};
  const fallbackOf: Record<number, string> = {};
  for (const group of groups) {
    for (const slot of group.slots) {
      roleOf[slot.index] = publicRoleOf(slot.index);
      fallbackOf[slot.index] = publicFallbackOf(slot.index);
    }
  }

  return (
    <Site
      groups={groups}
      roleOf={roleOf}
      fallbackOf={fallbackOf}
      seed={seed}
      enterArt={ENTER_ART}
      bgArt={BG_ART}
      blArt={BL_ART}
      brailleGlyphs={BRAILLE_GLYPHS}
    />
  );
}