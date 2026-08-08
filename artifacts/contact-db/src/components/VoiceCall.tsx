/**
 * VoiceCall — Twilio Voice calling UI for contact profiles.
 *
 * Exports:
 *   CallButton        — header button (shows when contact has a phone number)
 *   ActiveCallWidget  — floating panel rendered during an active call
 *   PostCallPanel     — drawer shown after call ends (transcription + AI summary)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import {
  PhoneCall, PhoneOff, Mic, MicOff, Loader2, Phone,
  FileText, Sparkles, Clock, CheckCheck, Volume2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CallRecord {
  id: number;
  contactId: number;
  status: string;
  callMode: string;
  durationSeconds: number | null;
  recordingUrl: string | null;
  transcription: string | null;
  aiSummary: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

type CallPhase =
  | { type: "idle" }
  | { type: "pre-call" }
  | { type: "connecting"; mode: "browser" | "phone" }
  | { type: "active"; mode: "browser" | "phone"; call: CallRecord; startTime: number; muted: boolean; twilioCall?: unknown }
  | { type: "ended"; call: CallRecord };

// ── formatDuration ─────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── CallButton ─────────────────────────────────────────────────────────────

export function CallButton({
  contactPhone,
  onInitiate,
}: {
  contactPhone: string;
  onInitiate: () => void;
}) {
  if (!contactPhone) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 h-8 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
      onClick={onInitiate}
    >
      <PhoneCall className="h-3.5 w-3.5" /> Call
    </Button>
  );
}

// ── PreCallModal ───────────────────────────────────────────────────────────

export function PreCallModal({
  open,
  contactName,
  contactPhone,
  onClose,
  onStart,
}: {
  open: boolean;
  contactName: string;
  contactPhone: string;
  onClose: () => void;
  onStart: (mode: "browser" | "phone", userPhone?: string) => void;
}) {
  const [mode, setMode] = useState<"browser" | "phone">("browser");
  const [userPhone, setUserPhone] = useState("");

  function handleStart() {
    if (mode === "phone" && !userPhone.trim()) return;
    onStart(mode, mode === "phone" ? userPhone.trim() : undefined);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border/60">
          <DialogTitle className="text-base flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center">
              <PhoneCall className="h-4 w-4 text-emerald-700" />
            </div>
            Call {contactName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Calling <span className="font-medium text-foreground">{contactPhone}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3">
          {/* Mode selector */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How to call</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode("browser")}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all",
                  mode === "browser"
                    ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                    : "border-border/60 hover:border-border text-muted-foreground"
                )}
              >
                <Volume2 className="h-5 w-5" />
                <span className="text-[11px] font-semibold">Via browser</span>
                <span className="text-[10px] leading-tight opacity-70">Mic & speakers</span>
              </button>
              <button
                onClick={() => setMode("phone")}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all",
                  mode === "phone"
                    ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                    : "border-border/60 hover:border-border text-muted-foreground"
                )}
              >
                <Phone className="h-5 w-5" />
                <span className="text-[11px] font-semibold">My phone</span>
                <span className="text-[10px] leading-tight opacity-70">We call you first</span>
              </button>
            </div>
          </div>

          {/* Phone number input for phone mode */}
          {mode === "phone" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Your phone number</label>
              <input
                type="tel"
                value={userPhone}
                onChange={(e) => setUserPhone(e.target.value)}
                placeholder="+1 555 000 0000"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <p className="text-[10px] text-muted-foreground">We'll call this number first, then connect you to {contactName}.</p>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <CheckCheck className="h-3 w-3 text-emerald-500" />
            Calls are recorded and automatically transcribed.
          </p>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border/60">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleStart}
            disabled={mode === "phone" && !userPhone.trim()}
          >
            <PhoneCall className="h-3.5 w-3.5" /> Start Call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── ActiveCallWidget ───────────────────────────────────────────────────────

export function ActiveCallWidget({
  phase,
  contactName,
  onMute,
  onHangUp,
}: {
  phase: CallPhase;
  contactName: string;
  onMute: () => void;
  onHangUp: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase.type === "active") {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - phase.startTime) / 1000));
      }, 1000);
    } else {
      setElapsed(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase.type, phase.type === "active" ? phase.startTime : null]);

  if (phase.type !== "connecting" && phase.type !== "active") return null;

  const isConnecting = phase.type === "connecting";
  const muted = phase.type === "active" ? phase.muted : false;
  const isPhoneMode = phase.type === "active" ? phase.mode === "phone" : phase.type === "connecting" ? phase.mode === "phone" : false;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl bg-gray-900 text-white shadow-2xl border border-white/10 overflow-hidden">
      {/* Status bar */}
      <div className="px-4 py-2.5 bg-emerald-700/30 border-b border-white/10 flex items-center gap-2">
        {isConnecting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-300" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        )}
        <span className="text-[11px] font-semibold text-emerald-200">
          {isConnecting
            ? (isPhoneMode ? "Calling your phone…" : "Connecting…")
            : "In progress"}
        </span>
        {!isConnecting && (
          <span className="ml-auto text-[11px] font-mono text-emerald-300">{formatDuration(elapsed)}</span>
        )}
      </div>

      {/* Contact info */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
          <Phone className="h-5 w-5 text-white/80" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{contactName}</p>
          <p className="text-[11px] text-white/50">
            {isPhoneMode ? "Via your phone" : "Via browser"}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 pb-4 flex items-center justify-center gap-3">
        {/* Mute (only in browser mode) */}
        {!isPhoneMode && (
          <button
            onClick={onMute}
            className={cn(
              "h-11 w-11 rounded-full flex items-center justify-center transition-colors",
              muted ? "bg-white text-gray-900" : "bg-white/10 hover:bg-white/20 text-white"
            )}
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        )}

        {/* Hang up */}
        <button
          onClick={onHangUp}
          className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors"
        >
          <PhoneOff className="h-6 w-6 text-white" />
        </button>
      </div>
    </div>
  );
}

// ── PostCallPanel ──────────────────────────────────────────────────────────

export function PostCallPanel({
  call,
  contactName,
  onClose,
}: {
  call: CallRecord;
  contactName: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [notes, setNotes] = useState(call.notes ?? "");
  const [saving, setSaving] = useState(false);

  // Poll until transcription + summary arrive (up to 5 min)
  const { data: liveCall } = useQuery<CallRecord>({
    queryKey: ["call", call.id],
    queryFn: async () => {
      const r = await apiFetch(`/api/calls/${call.id}`);
      if (!r.ok) throw new Error("Failed to fetch call");
      return r.json();
    },
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return 3000;
      if (data.transcription && data.aiSummary) return false;
      return 4000;
    },
    initialData: call,
  });

  async function saveNotes() {
    setSaving(true);
    try {
      const r = await apiFetch(`/api/calls/${call.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!r.ok) throw new Error("Failed to save");
      await qc.invalidateQueries({ queryKey: ["contact-calls", call.contactId] });
      toast({ title: "Notes saved" });
    } catch {
      toast({ title: "Failed to save notes", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const c = liveCall ?? call;
  const duration = c.durationSeconds ? formatDuration(c.durationSeconds) : null;
  const hasTranscript = !!c.transcription;
  const hasSummary = !!c.aiSummary;
  const stillLoading = !hasTranscript || !hasSummary;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-border/60 flex-shrink-0">
          <DialogTitle className="text-base flex items-center gap-2">
            <CheckCheck className="h-4 w-4 text-emerald-500" /> Call with {contactName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {duration ? `Duration: ${duration}` : "Call completed"}{" · "}
            {c.callMode === "phone" ? "Via phone" : "Via browser"}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* Recording */}
          {c.recordingUrl && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Recording</p>
              {/* Use the server-side proxy so the browser never supplies Twilio credentials */}
              <audio controls src={`/api/calls/${c.id}/recording`} className="w-full h-9 rounded-lg" />
            </div>
          )}

          {/* AI Summary */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">AI Summary</p>
              {!hasSummary && stillLoading && (
                <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Generating…
                </span>
              )}
            </div>
            {hasSummary ? (
              <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3">
                <pre className="text-[12px] leading-relaxed text-foreground whitespace-pre-wrap font-sans">{c.aiSummary}</pre>
              </div>
            ) : (
              <div className="rounded-xl bg-secondary/30 border border-border/40 px-4 py-3 space-y-2">
                {[80, 60, 70].map((w, i) => (
                  <div key={i} className={`h-3 rounded bg-muted animate-pulse`} style={{ width: `${w}%` }} />
                ))}
              </div>
            )}
          </div>

          {/* Transcript */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <FileText className="h-3.5 w-3.5 text-blue-500" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Transcript</p>
              {!hasTranscript && (
                <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Processing…
                </span>
              )}
            </div>
            {hasTranscript ? (
              <div className="rounded-xl bg-secondary/30 border border-border/40 px-4 py-3 max-h-48 overflow-y-auto">
                <p className="text-[12px] leading-relaxed text-foreground whitespace-pre-wrap">{c.transcription}</p>
              </div>
            ) : (
              <div className="rounded-xl bg-secondary/30 border border-border/40 px-4 py-3 space-y-1.5">
                {[100, 85, 90, 70].map((w, i) => (
                  <div key={i} className="h-2.5 rounded bg-muted animate-pulse" style={{ width: `${w}%` }} />
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Your Notes</p>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this call…"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
            />
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border/60 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          <Button size="sm" onClick={saveNotes} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            Save Notes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── useVoiceCall — main hook wiring Twilio Device ──────────────────────────

export function useVoiceCall(contactId: number, contactName: string) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<CallPhase>({ type: "idle" });
  const deviceRef = useRef<unknown>(null);
  const callRef = useRef<unknown>(null);

  const openPreCall = useCallback(() => setPhase({ type: "pre-call" }), []);
  const closePreCall = useCallback(() => setPhase({ type: "idle" }), []);

  const startCall = useCallback(async (mode: "browser" | "phone", userPhone?: string) => {
    setPhase({ type: "connecting", mode });

    try {
      const r = await apiFetch("/api/calls/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, mode, userPhone }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to initiate call");
      }

      const data = await r.json() as {
        call: CallRecord;
        token?: string;
        contactPhone?: string;
        mode: "browser" | "phone";
      };

      if (mode === "phone") {
        // Phone mode: show active panel, poll for completion
        setPhase({ type: "active", mode: "phone", call: data.call, startTime: Date.now(), muted: false });
        pollPhoneCallStatus(data.call);
        return;
      }

      // Browser mode: use Twilio Voice SDK
      if (!data.token || !data.contactPhone) {
        throw new Error("Missing token or contact phone from server");
      }

      const { Device } = await import("@twilio/voice-sdk");

      const device = new Device(data.token, { logLevel: 1 });
      deviceRef.current = device;

      const twilioCall = await device.connect({
        params: {
          To: data.contactPhone,
          callId: String(data.call.id),
        },
      });
      callRef.current = twilioCall;

      setPhase({ type: "active", mode: "browser", call: data.call, startTime: Date.now(), muted: false, twilioCall });

      (twilioCall as { on: (event: string, fn: (...args: unknown[]) => void) => void }).on("accept", () => {
        setPhase((p) => p.type === "active" ? { ...p } : p);
      });

      (twilioCall as { on: (event: string, fn: (...args: unknown[]) => void) => void }).on("disconnect", () => {
        endCallLocally(data.call);
      });

      (twilioCall as { on: (event: string, fn: (...args: unknown[]) => void) => void }).on("cancel", () => {
        endCallLocally(data.call);
      });

      (twilioCall as { on: (event: string, fn: (...args: unknown[]) => void) => void }).on("error", (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Call error";
        toast({ title: "Call error", description: msg, variant: "destructive" });
        endCallLocally(data.call);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to start call", description: msg, variant: "destructive" });
      setPhase({ type: "idle" });
    }
  }, [contactId, toast]);

  function endCallLocally(call: CallRecord) {
    const d = deviceRef.current as { destroy?: () => void } | null;
    d?.destroy?.();
    deviceRef.current = null;
    callRef.current = null;
    setPhase({ type: "ended", call });
  }

  async function pollPhoneCallStatus(call: CallRecord) {
    const maxAttempts = 120; // 10 minutes
    let attempts = 0;
    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 5000));
      attempts++;
      try {
        const r = await apiFetch(`/api/calls/${call.id}`);
        if (!r.ok) continue;
        const updated = await r.json() as CallRecord;
        if (["completed", "failed", "busy", "no-answer", "canceled"].includes(updated.status)) {
          setPhase({ type: "ended", call: updated });
          return;
        }
      } catch { /* continue polling */ }
    }
    // Timeout — move to ended anyway
    setPhase({ type: "ended", call });
  }

  const mute = useCallback(() => {
    setPhase((p) => {
      if (p.type !== "active" || p.mode !== "browser") return p;
      const c = callRef.current as { mute?: (v: boolean) => void } | null;
      const newMuted = !p.muted;
      c?.mute?.(newMuted);
      return { ...p, muted: newMuted };
    });
  }, []);

  const hangUp = useCallback(() => {
    setPhase((p) => {
      if (p.type === "active") {
        if (p.mode === "browser") {
          const c = callRef.current as { disconnect?: () => void } | null;
          c?.disconnect?.();
          const d = deviceRef.current as { destroy?: () => void } | null;
          d?.destroy?.();
          deviceRef.current = null;
          callRef.current = null;
        }
        return { type: "ended", call: p.call };
      }
      if (p.type === "connecting") return { type: "idle" };
      return p;
    });
  }, []);

  const dismissPostCall = useCallback(() => setPhase({ type: "idle" }), []);

  return { phase, openPreCall, closePreCall, startCall, mute, hangUp, dismissPostCall };
}
