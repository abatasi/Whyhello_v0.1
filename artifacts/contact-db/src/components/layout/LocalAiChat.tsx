import { useEffect, useRef, useState } from "react";
import { Bot, Send, X } from "lucide-react";

type PreviewMessage = {
  id: number;
  text: string;
};

export function LocalAiChat() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        requestAnimationFrame(() => launcherRef.current?.focus());
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [...current, { id: nextId.current++, text }]);
    setDraft("");
  }

  return (
    <>
      {open && (
        <section
          id="panel-ai-chat-preview"
          aria-label="Whyhello AI chat preview"
          aria-modal="false"
          role="dialog"
          className="fixed bottom-[3.25rem] right-3 z-40 flex h-[min(30rem,calc(100dvh-5rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-[0_18px_55px_-24px_rgba(10,15,24,0.55)] sm:bottom-14 sm:right-5"
          data-testid="panel-ai-chat-preview"
        >
          <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Bot className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold leading-5">Whyhello assistant</h2>
                <p className="text-[11px] text-muted-foreground">Local chat preview</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                requestAnimationFrame(() => launcherRef.current?.focus());
              }}
              aria-label="Close chat preview"
              data-testid="button-close-ai-chat"
              className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </header>

          <div className="border-b border-border bg-secondary/55 px-4 py-2.5">
            <p className="text-[11px] leading-4 text-muted-foreground" data-testid="text-ai-preview-disclaimer">
              Preview only. Messages stay in this window; AI replies are not connected yet.
            </p>
          </div>

          <div
            className="scroll-thin flex-1 space-y-3 overflow-y-auto px-4 py-4"
            aria-live="polite"
            aria-label="Chat messages"
          >
            {messages.length === 0 ? (
              <div className="flex h-full min-h-36 flex-col items-center justify-center px-3 text-center">
                <span className="mb-3 grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground">
                  <Bot className="size-5" aria-hidden="true" />
                </span>
                <p className="text-sm font-medium">A space for your thinking</p>
                <p className="mt-1 max-w-[15rem] text-xs leading-5 text-muted-foreground">
                  Write a note or question. Your message will appear here without being sent anywhere.
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="flex justify-end">
                  <p
                    data-testid={`text-preview-message-${message.id}`}
                    className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm leading-5 text-primary-foreground"
                  >
                    {message.text}
                  </p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={sendMessage} className="border-t border-border bg-card p-3">
            <label htmlFor="ai-preview-composer" className="sr-only">Write a message</label>
            <div className="flex items-end gap-2 rounded-lg border border-border bg-background p-1.5 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
              <textarea
                id="ai-preview-composer"
                ref={inputRef}
                rows={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Write a message…"
                data-testid="input-ai-preview-message"
                className="max-h-28 min-h-9 flex-1 resize-y bg-transparent px-2 py-2 text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Add message to preview"
                data-testid="button-send-ai-preview-message"
                className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-md bg-foreground text-background transition-colors hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#252726] dark:text-white dark:hover:bg-[#353837]"
              >
                <Send className="size-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 px-1 text-[10px] text-muted-foreground">Enter to add · Shift + Enter for a new line</p>
          </form>
        </section>
      )}

      <footer
        className="flex h-8 shrink-0 items-center justify-end border-t border-white/[0.08] bg-[#111211] px-2 text-white"
        aria-label="Workspace utilities"
        data-testid="workspace-footer-belt"
      >
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? "Close Whyhello assistant preview" : "Open Whyhello assistant preview"}
          aria-expanded={open}
          aria-controls={open ? "panel-ai-chat-preview" : undefined}
          title={open ? "Close chat preview" : "Open chat preview"}
          data-testid="button-open-ai-chat"
          className="grid size-7 cursor-pointer place-items-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <Bot className="size-4" aria-hidden="true" />
        </button>
      </footer>
    </>
  );
}
