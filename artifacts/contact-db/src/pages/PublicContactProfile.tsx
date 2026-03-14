import { useRoute, Link } from "wouter";
import { useGetContact } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { ArrowLeft, MapPin, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { getInitials, cn } from "@/lib/utils";
import whyhelloLogo from "@assets/Untitled_design_1773415520137.png";

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function PublicContactProfile() {
  const [, params] = useRoute("/contacts/:id");
  const id = parseInt(params?.id || "0");
  const { login } = useAuth();

  const { data: contact, isLoading, isError } = useGetContact(id, {
    query: { enabled: !!id },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <PublicHeader onLogin={login} />
        <div className="max-w-5xl mx-auto px-6 py-8 animate-pulse space-y-6">
          <div className="h-8 w-28 bg-muted rounded" />
          <div className="bg-card border rounded-2xl p-8 flex items-start gap-6">
            <div className="w-28 h-28 bg-muted rounded-full flex-shrink-0" />
            <div className="space-y-3 flex-1">
              <div className="h-7 bg-muted rounded w-2/5" />
              <div className="h-4 bg-muted rounded w-1/3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !contact) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <PublicHeader onLogin={login} />
        <div className="p-8 text-center mt-20">
          <h2 className="text-2xl font-bold mb-4">Contact not found</h2>
          <Link href="/"><span className="text-primary underline cursor-pointer">Back to Directory</span></Link>
        </div>
      </div>
    );
  }

  const fullName = `${contact.firstName} ${contact.lastName}`;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <PublicHeader onLogin={login} />

      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back to Directory
        </Link>

        {/* Hero Card — fully visible */}
        <div className="bg-card rounded-2xl shadow-sm border border-border/60 overflow-hidden mb-6">
          <div className="h-28 bg-gradient-to-r from-primary/15 via-indigo-100/60 to-violet-100/40" />
          <div className="px-8 pb-7">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="-mt-14 flex-shrink-0">
                <div className="h-28 w-28 rounded-full border-4 border-card bg-gradient-to-br from-indigo-100 to-blue-50 flex items-center justify-center text-3xl font-bold text-primary shadow-md">
                  {getInitials(fullName)}
                </div>
              </div>
              <div className="flex-1 pt-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground">{fullName}</h1>
                  {contact.seniority && (
                    <Badge variant="success" className="text-xs">{contact.seniority}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground mt-1 text-sm flex-wrap">
                  <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{contact.jobTitle}</span>
                  {contact.department && (
                    <><span className="opacity-40">·</span><span>{contact.department}</span></>
                  )}
                  {contact.company && (
                    <><span className="opacity-40">at</span><span className="text-primary font-medium">{contact.company.name}</span></>
                  )}
                </div>
                {(contact.location || contact.country) && (
                  <div className="flex items-center gap-1.5 text-muted-foreground mt-2 text-sm">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{[contact.location, contact.country].filter(Boolean).join(", ")}</span>
                  </div>
                )}
                {contact.bio && (
                  <p className="text-sm text-muted-foreground mt-3 max-w-xl leading-relaxed line-clamp-3">
                    {contact.bio}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Wall: blurred preview + sign-in overlay */}
        <div className="relative min-h-[360px]">
          {/* Blurred skeleton of what's below */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 select-none pointer-events-none blur-sm opacity-40" aria-hidden>
            <div className="space-y-4">
              <div className="bg-card rounded-2xl border border-border/60 p-6 space-y-4">
                <div className="h-3 bg-muted rounded w-24" />
                {[40, 32, 36].map((w, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex-shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-2 bg-muted rounded" style={{ width: `${w}%` }} />
                      <div className="h-3 bg-muted rounded" style={{ width: `${w + 20}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {contact.company && (
                <div className="bg-card rounded-2xl border border-border/60 p-6 space-y-3">
                  <div className="h-3 bg-muted rounded w-28" />
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-muted" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 bg-muted rounded w-3/4" />
                      <div className="h-2 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-card rounded-2xl border border-border/60 p-6 space-y-3">
                <div className="h-3 bg-muted rounded w-32" />
                <div className="h-14 bg-muted rounded-xl w-full" />
                <div className="h-14 bg-muted rounded-xl w-full" />
                <div className="h-14 bg-muted rounded-xl w-4/5" />
              </div>
            </div>
          </div>

          {/* Gradient fade */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#F8FAFC]/10 via-[#F8FAFC]/60 to-[#F8FAFC] pointer-events-none" />

          {/* Sign-in overlay card */}
          <div className="absolute inset-0 flex items-center justify-center px-4 pt-8">
            <div className="relative z-10 bg-card border border-border rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-100 to-primary/20 flex items-center justify-center text-lg font-bold text-primary mx-auto mb-4">
                {getInitials(fullName)}
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                View {contact.firstName}&apos;s full profile
              </h2>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Sign in to access contact details, personal insights, LinkedIn, and more.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={login}
                  className="flex items-center justify-center gap-3 w-full px-5 py-3 bg-white border border-border rounded-xl text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors shadow-sm"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
                <button
                  onClick={login}
                  className="flex items-center justify-center gap-3 w-full px-5 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Sign up with Email
                </button>
              </div>

              <p className="text-xs text-muted-foreground mt-4">
                Already have an account?{" "}
                <button onClick={login} className="text-primary font-medium hover:underline">
                  Sign in
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PublicHeader({ onLogin }: { onLogin: () => void }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <img src={whyhelloLogo} alt="Whyhello" className="h-6 w-auto" />
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={onLogin}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </button>
          <button
            onClick={onLogin}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Get started
          </button>
        </div>
      </div>
    </header>
  );
}
