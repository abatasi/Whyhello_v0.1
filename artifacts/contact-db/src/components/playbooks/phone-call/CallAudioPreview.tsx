import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, RefreshCw, X } from "lucide-react";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { apiFetch } from "@/lib/apiFetch";
import type { CallScript } from "../phone-call-model";
import { CALL_AUDIO_CHARACTER_LIMIT, callAudioText, type CallAudioSection } from "./call-audio-text";

const buttonClass = "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50";

export function CallAudioPreview({ playbookId, script, generatingScript }: {
  playbookId: number; script: CallScript; generatingScript: boolean;
}) {
  const [section, setSection] = useState<CallAudioSection>("conversation");
  const [recording, setRecording] = useState<{ url: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [speed, setSpeed] = useState(1);
  const requestRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const setAudioNode = useCallback((node: HTMLAudioElement | null) => {
    if (audioRef.current && audioRef.current !== node) audioRef.current.pause();
    audioRef.current = node;
  }, []);
  const text = callAudioText(script, section);
  const currentText = useRef(text);
  currentText.current = text;
  const stale = !!recording && recording.text !== text;

  const cancel = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setBusy(false);
  };
  useEffect(() => {
    if (recording?.text !== text || generatingScript) audioRef.current?.pause();
    if (requestRef.current) { requestRef.current.abort(); requestRef.current = null; setBusy(false); }
    setError("");
  }, [text, generatingScript]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, recording]);
  useEffect(() => () => {
    requestRef.current?.abort();
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  async function generate() {
    if (!text.trim() || text.length > CALL_AUDIO_CHARACTER_LIMIT || generatingScript || busy) return;
    cancel();
    audioRef.current?.pause();
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true); setError("");
    const requestedText = text;
    try {
      const response = await apiFetch(`/api/playbooks/${playbookId}/phone-call/audio`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: requestedText }), signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "The audio preview could not be generated.");
      }
      if (!response.headers.get("Content-Type")?.includes("audio/")) throw new Error("The server did not return playable audio.");
      const blob = await response.blob();
      if (!blob.size) throw new Error("The audio preview was empty. Try again.");
      if (controller.signal.aborted || requestRef.current !== controller || currentText.current !== requestedText) return;
      const url = URL.createObjectURL(blob);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setRecording({ url, text: requestedText });
    } catch (cause) {
      if (!controller.signal.aborted && requestRef.current === controller) setError(cause instanceof Error ? cause.message : "Audio generation failed. Try again.");
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setBusy(false); }
    }
  }

  return <section aria-label="Call script listening preview" className="rounded-md border border-border p-3">
    <div className="flex items-center gap-2 text-xs font-semibold"><Headphones size={14} />Listen to the delivery</div>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">Hear the current script’s rhythm and pacing in an AI voice. Conversation playback includes the opener, talking points, questions, and closing—not recipient replies or research notes.</p>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <select aria-label="Call audio section" className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={section} disabled={generatingScript} onChange={event => setSection(event.target.value as CallAudioSection)}>
        <option value="conversation">Conversation script</option><option value="opener">Opener only</option><option value="voicemail">Voicemail</option>
      </select>
      <button type="button" className={buttonClass} disabled={busy || generatingScript || !text.trim() || text.length > CALL_AUDIO_CHARACTER_LIMIT} onClick={generate}>{busy ? <ThinkingIndicator decorative className="h-3.5 w-5" /> : recording ? <RefreshCw size={13} /> : <Headphones size={13} />}{busy ? "Generating audio…" : recording ? "Regenerate audio" : "Generate audio"}</button>
      {busy && <button type="button" className={buttonClass} onClick={cancel}><X size={13} />Cancel</button>}
    </div>
    {!text.trim() && <p className="mt-2 text-xs text-muted-foreground">This section is empty. Add script text to listen to it.</p>}
    {text.length > CALL_AUDIO_CHARACTER_LIMIT && <p role="alert" className="mt-2 text-xs text-destructive">This section exceeds 6000 characters. Choose a shorter section or shorten the script before generating audio.</p>}
    {busy && <p role="status" className="mt-2 text-xs text-muted-foreground">Preparing the spoken preview. Your script stays editable.</p>}
    {stale && <p role="status" className="mt-2 text-xs text-muted-foreground">The script or selected section changed. Generate new audio to hear the current wording.</p>}
    {recording && !stale && !generatingScript && <div className="mt-3 space-y-2">
      <audio aria-label="Spoken call script" controls preload="metadata" src={recording.url} ref={setAudioNode} className="w-full" onLoadedMetadata={() => { if (audioRef.current) audioRef.current.playbackRate = speed; }} onError={() => setError("This browser could not play the audio. Try regenerating the preview.")} />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">Playback speed<select aria-label="Call audio playback speed" className="rounded-md border border-input bg-background px-2 py-1" value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value={0.85}>0.85× · Slower</option><option value={1}>1× · Natural</option><option value={1.15}>1.15× · Faster</option></select></label>
    </div>}
    {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Audio generation uses AI credits. Replay does not regenerate audio. This is a rehearsal only; it never places a call. Audio is temporary and can be regenerated after reload.</p>
  </section>;
}