import { useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { resolveHqToneChoice, type HqVoiceProfile, type ScopedHqToneChoice } from "@/lib/hq-voice-profile-model";

export { toVoicePickerContext } from "@/lib/hq-voice-profile-model";

export function useHqVoiceProfile(enabled = true) {
  const { user } = useUser();
  return useQuery({
    queryKey: ["hq-profile", user?.id ?? "signed-out"],
    queryFn: async () => {
      const response = await apiFetch("/api/hq/profile");
      if (!response.ok) throw new Error("Couldn't load saved voices.");
      const payload = await response.json() as { data: HqVoiceProfile | null; revision: string };
      return payload.data;
    },
    enabled: enabled && !!user?.id,
    staleTime: 0,
  });
}

/** Defaults follow owned HQ data until the user makes an explicit selection. */
export function useHqToneSelection(profile: HqVoiceProfile | null | undefined, enabled = true) {
  const { user } = useUser();
  const scope = user?.id ?? "signed-out";
  const [override, setOverride] = useState<ScopedHqToneChoice | null>(null);
  useEffect(() => { setOverride(null); }, [scope]);
  useEffect(() => { if (!enabled) setOverride(null); }, [enabled]);
  const choice = resolveHqToneChoice(profile, scope, override);
  return {
    ...choice,
    setTone: (tone: string) => setOverride(previous => ({ ...resolveHqToneChoice(profile, scope, previous), scope, tone })),
    setVoicePersonaId: (voicePersonaId: string | null) => setOverride(previous => ({ ...resolveHqToneChoice(profile, scope, previous), scope, voicePersonaId })),
  };
}
