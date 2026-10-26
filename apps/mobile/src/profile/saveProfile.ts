import { useAppStore } from "@/state/store";
import { submit } from "@/sync/engine";
import type { StoredProfile } from "@/sync/types";
import type { ProfileDraft } from "./ProfileFields";

export function draftFromProfile(profile: StoredProfile | null): ProfileDraft {
  return {
    weightKg: profile?.weightKg ?? 70,
    declaredBody: profile?.declaredBody ?? "female",
    heightCm: profile?.heightCm ?? null,
  };
}

export function saveProfile(draft: ProfileDraft, consentAt: number): void {
  const previous = useAppStore.getState().profile;
  const profile: StoredProfile = {
    weightKg: draft.weightKg,
    // "Other" uses the female body model: it gives the higher, safer estimate.
    bodyModel: draft.declaredBody === "male" ? "male" : "female",
    declaredBody: draft.declaredBody,
    healthConsentAt: consentAt,
  };
  if (draft.heightCm !== null) profile.heightCm = draft.heightCm;
  submit({ kind: "profile.set", profile, previous });
}
