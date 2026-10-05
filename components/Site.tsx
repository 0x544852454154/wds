"use client";

import { useCallback, useMemo, useState } from "react";

import { AmbientArt } from "@/components/AmbientArt";
import { EnterGate } from "@/components/EnterGate";
import { FluidCanvas } from "@/components/FluidCanvas";
import { ProfileModal } from "@/components/ProfileModal";
import { RainCanvas } from "@/components/RainCanvas";
import { Roster } from "@/components/Roster";
import { SourceProtection } from "@/components/SourceProtection";
import { useBannerReveal } from "@/hooks/useBannerReveal";
import { usePresence } from "@/hooks/usePresence";
import type { PublicPresence } from "@/lib/public";

export interface SiteProps {
  groups: Array<{ name: string; slots: Array<{ index: number; fallbackName: string }> }>;
  roleOf: Record<number, string>;
  fallbackOf: Record<number, string>;
  seed: PublicPresence[];
  enterArt: string;
  bgArt: string;
  blArt: string;
  brailleGlyphs: string;
}

export function Site({
  groups,
  roleOf,
  fallbackOf,
  seed,
  enterArt,
  bgArt,
  blArt,
  brailleGlyphs,
}: SiteProps) {
  const [entered, setEntered] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const { hostRef: bannerRef } = useBannerReveal(entered);
  const { members } = usePresence(seed);

  const onEnter = useCallback(() => setEntered(true), []);

  const openMember = useMemo(() => {
    if (openIndex === null) return null;
    return {
      member: members.get(openIndex),
      fallbackName: fallbackOf[openIndex] ?? "",
      role: roleOf[openIndex] ?? "",
    };
  }, [openIndex, members, fallbackOf, roleOf]);

  return (
    <>
      <SourceProtection />

      <RainCanvas />
      <FluidCanvas enabled={entered} />

      {entered && (
        <>
          <AmbientArt source={bgArt} glyphs={brailleGlyphs} id="bgart" variant="bg" />
          <AmbientArt source={blArt} glyphs={brailleGlyphs} id="blart" variant="bl" />
        </>
      )}

      <EnterGate enterArt={enterArt} onEnter={onEnter} />

      <div className="shell">
        <div id="banner" ref={bannerRef} />
        <div className="sub">
          <span>developed by @soulja</span>
        </div>
        <Roster groups={groups} members={members} onSelect={setOpenIndex} />
      </div>

      {openMember && (
        <ProfileModal
          member={openMember.member}
          fallbackName={openMember.fallbackName}
          role={openMember.role}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}