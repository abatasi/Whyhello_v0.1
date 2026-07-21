import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Chrome, Unlink, CheckCircle2, AlertCircle, Loader2, Settings as SettingsIcon, ArrowRight } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { useToast } from "@/hooks/use-toast";

interface EmailAccount {
  id: number;
  provider: "gmail" | "outlook";
  email: string;
  displayName: string | null;
  createdAt: string;
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 21 21" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

function GmailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.910 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
    </svg>
  );
}

export default function Settings() {
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const connected = params.get("connected");
  const errorParam = params.get("error");

  useEffect(() => {
    document.title = "Settings · Whyhello";
    return () => { document.title = "Whyhello"; };
  }, []);

  useEffect(() => {
    if (connected === "gmail") {
      toast({ title: "Gmail connected", description: "You can now send emails via Gmail." });
    } else if (connected === "outlook") {
      toast({ title: "Outlook connected", description: "You can now send emails via Outlook." });
    } else if (errorParam) {
      const messages: Record<string, string> = {
        invalid_state: "OAuth session expired. Please try again.",
        google_failed: "Failed to connect Gmail. Please try again.",
        microsoft_failed: "Failed to connect Outlook. Please try again.",
        access_denied: "Access was denied. Please allow the requested permissions.",
      };
      toast({ title: "Connection failed", description: messages[errorParam] ?? errorParam, variant: "destructive" });
    }
  }, [connected, errorParam]);

  const { data: accounts = [], isLoading } = useQuery<EmailAccount[]>({
    queryKey: ["email-accounts"],
    queryFn: () => fetch("/api/email-accounts").then((r) => r.json()),
  });

  const disconnect = useMutation({
    mutationFn: (id: number) => fetch(`/api/email-accounts/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
      toast({ title: "Account disconnected" });
    },
    onError: () => {
      toast({ title: "Failed to disconnect", variant: "destructive" });
    },
  });

  const gmailAccount = accounts.find((a) => a.provider === "gmail");
  const outlookAccount = accounts.find((a) => a.provider === "outlook");

  function connectGoogle() {
    window.location.href = "/api/email-accounts/auth/google";
  }

  function connectMicrosoft() {
    window.location.href = "/api/email-accounts/auth/microsoft";
  }

  return (
    <Shell>
      <div className="max-w-2xl mx-auto px-6 py-10 w-full">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <SettingsIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your account integrations</p>
          </div>
        </div>

        <section className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Connected Email Accounts</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Connect your email so messages sent from Whyhello arrive from your own address.
            </p>
          </div>

          {isLoading ? (
            <div className="px-6 py-10 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              <div className="px-6 py-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                    <GmailIcon />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Gmail</p>
                    {gmailAccount ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span className="text-xs text-muted-foreground">{gmailAccount.displayName ? `${gmailAccount.displayName} · ` : ""}{gmailAccount.email}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">Not connected</p>
                    )}
                  </div>
                </div>
                {gmailAccount ? (
                  <button
                    onClick={() => disconnect.mutate(gmailAccount.id)}
                    disabled={disconnect.isPending}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors px-3 py-1.5 rounded-lg hover:bg-destructive/5 border border-transparent hover:border-destructive/20 disabled:opacity-50"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={connectGoogle}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 border border-primary/20"
                  >
                    Connect
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="px-6 py-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                    <MicrosoftIcon />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Microsoft Outlook</p>
                    {outlookAccount ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span className="text-xs text-muted-foreground">{outlookAccount.displayName ? `${outlookAccount.displayName} · ` : ""}{outlookAccount.email}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">Not connected</p>
                    )}
                  </div>
                </div>
                {outlookAccount ? (
                  <button
                    onClick={() => disconnect.mutate(outlookAccount.id)}
                    disabled={disconnect.isPending}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors px-3 py-1.5 rounded-lg hover:bg-destructive/5 border border-transparent hover:border-destructive/20 disabled:opacity-50"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={connectMicrosoft}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 border border-primary/20"
                  >
                    Connect
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {!isLoading && accounts.length === 0 && (
            <div className="px-6 pb-5">
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50/60 border border-amber-100">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Connect at least one email account to send messages from Whyhello.
                  Emails will be delivered from your own address.
                </p>
              </div>
            </div>
          )}

          <div className="px-6 py-4 bg-muted/20 border-t border-border/50">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Whyhello requests only the minimum permissions needed to send email on your behalf.
              Your credentials are stored securely and never shared. You can disconnect at any time.
            </p>
          </div>
        </section>

        <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border/50">
          <p className="text-xs font-semibold text-foreground mb-1.5">Redirect URIs for OAuth apps</p>
          <p className="text-[11px] text-muted-foreground mb-2">Add these to your Google Cloud and Azure app registrations:</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border border-border/60 font-mono text-[11px] text-muted-foreground overflow-x-auto">
              <span className="text-red-500 font-sans font-medium flex-shrink-0">Google:</span>
              <span>{window.location.origin}/api/email-accounts/auth/google/callback</span>
            </div>
            <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border border-border/60 font-mono text-[11px] text-muted-foreground overflow-x-auto">
              <span className="text-blue-500 font-sans font-medium flex-shrink-0">Microsoft:</span>
              <span>{window.location.origin}/api/email-accounts/auth/microsoft/callback</span>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
