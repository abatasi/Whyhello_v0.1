import { useRoute, Link, useLocation } from "wouter";
import {
  useGetContact,
  useGetContactInsights,
} from "@workspace/api-client-react";
import {
  ArrowLeft, Mail, Phone, MapPin, Building, Briefcase,
  Linkedin, Twitter, ExternalLink, Newspaper, Tv2,
  Mic2, FileText, Share2, Megaphone, ChevronRight, Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { getInitials, cn } from "@/lib/utils";
import whyhelloLogo from "@assets/Untitled_design_1773415520137.png";

const MEDIA_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  article:        { label: "Article",        icon: Newspaper,  color: "text-blue-600",   bg: "bg-blue-50 border-blue-100" },
  blog_post:      { label: "Blog Post",      icon: FileText,   color: "text-violet-600", bg: "bg-violet-50 border-violet-100" },
  video:          { label: "Video",          icon: Tv2,        color: "text-red-600",    bg: "bg-red-50 border-red-100" },
  podcast:        { label: "Podcast",        icon: Mic2,       color: "text-green-600",  bg: "bg-green-50 border-green-100" },
  linkedin_post:  { label: "LinkedIn Post",  icon: Share2,     color: "text-sky-600",    bg: "bg-sky-50 border-sky-100" },
  press_release:  { label: "Press Release",  icon: Megaphone,  color: "text-amber-600",  bg: "bg-amber-50 border-amber-100" },
};

function getMediaConfig(type: string) {
  return MEDIA_CONFIG[type] ?? { label: type, icon: ExternalLink, color: "text-muted-foreground", bg: "bg-secondary border-border" };
}

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

function PublicHeader({ onLogin }: { onLogin: () => void }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <img src={whyhelloLogo} alt="Whyhello" className="h-6 w-auto dark:hidden" />
          <span className="hidden dark:inline-flex items-center gap-2 text-lg font-bold tracking-tight text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">w</span>
            whyhello.
          </span>
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

function PublicLockedSection({
  onLogin,
  variant = "contact",
}: {
  onLogin: () => void;
  variant?: "contact" | "insights";
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-5">
      <div className="w-full space-y-3 blur-sm pointer-events-none select-none" aria-hidden>
        {variant === "contact" ? (
          <>
            {[40, 32, 36].map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary/70 flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-2.5 bg-muted rounded" style={{ width: `${w}%` }} />
                  <div className="h-3 bg-muted rounded" style={{ width: `${w + 20}%` }} />
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="h-14 bg-muted rounded-xl w-full" />
            <div className="h-14 bg-muted rounded-xl w-full" />
            <div className="h-14 bg-muted rounded-xl w-4/5" />
          </>
        )}
      </div>
      <button
        onClick={onLogin}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
      >
        <Lock className="h-4 w-4" />
        Reveal — 1 Credit
      </button>
    </div>
  );
}

function ContactInfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-secondary/70 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
        <div className="text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

export default function PublicContactProfile() {
  const [, params] = useRoute("/contacts/:id");
  const id = parseInt(params?.id || "0");
  const [, navigate] = useLocation();
  const login = () => navigate("/sign-in");

  const { data: contact, isLoading, isError } = useGetContact(id, {
    query: { enabled: !!id },
  });
  const { data: insights = [] } = useGetContactInsights(id, {
    query: { enabled: !!id },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
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
      <div className="min-h-screen bg-background">
        <PublicHeader onLogin={login} />
        <div className="p-8 text-center mt-20">
          <h2 className="text-2xl font-bold mb-4">Contact not found</h2>
          <Link href="/"><span className="text-primary underline cursor-pointer">Back to Directory</span></Link>
        </div>
      </div>
    );
  }

  const fullName = `${contact.firstName} ${contact.lastName}`;
  const hasContactInfo = contact.email || contact.phone || contact.linkedinUrl || contact.twitterHandle || contact.location || contact.country;

  const groupedInsights = insights.reduce<Record<string, typeof insights>>((acc, insight) => {
    if (!acc[insight.mediaType]) acc[insight.mediaType] = [];
    acc[insight.mediaType].push(insight);
    return acc;
  }, {});
  const mediaOrder = ["article", "press_release", "video", "podcast", "blog_post", "linkedin_post"];
  const sortedGroups = Object.entries(groupedInsights).sort(([a], [b]) => {
    const ai = mediaOrder.indexOf(a), bi = mediaOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader onLogin={login} />

      {/* Dark overlay below header — dims all content */}
      <div className="fixed left-0 right-0 bottom-0 top-16 z-10 bg-black/50 pointer-events-none" />

      {/* Sign-in card — fixed center of viewport below header */}
      <div className="fixed left-0 right-0 bottom-0 top-16 z-20 flex items-center justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto bg-card dark:bg-slate-900 border border-border dark:border-slate-600 rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="h-14 w-14 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-950 flex items-center justify-center text-xl font-bold mx-auto mb-4 shadow-sm">
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
              className="flex items-center justify-center gap-3 w-full px-5 py-3 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors shadow-sm"
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

      {/* Full profile content — rendered but dimmed beneath overlay */}
      <div className="bg-background min-h-full">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to Directory
          </Link>

          {/* Hero Card */}
          <div className="bg-card rounded-2xl shadow-sm border border-border/60 overflow-hidden mb-6">
            <div className="h-28 bg-slate-800 dark:bg-slate-700" />
            <div className="px-8 pb-7">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="-mt-14 flex-shrink-0">
                  <div className="h-28 w-28 rounded-full border-4 border-card bg-slate-900 text-white dark:bg-white dark:text-slate-950 flex items-center justify-center text-3xl font-bold shadow-md">
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
                    {contact.department && <><span className="opacity-40">·</span><span>{contact.department}</span></>}
                    {contact.company && (
                      <><span className="opacity-40">at</span><span className="text-primary font-medium">{contact.company.name}</span></>
                    )}
                  </div>
                  {contact.bio && (
                    <p className="text-sm text-muted-foreground mt-3 max-w-xl leading-relaxed line-clamp-2">
                      {contact.bio}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="space-y-6">
              {/* Contact Info — always locked on public page */}
              {hasContactInfo && (
                <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
                    Contact Info
                  </h2>
                  <PublicLockedSection onLogin={login} variant="contact" />
                </section>
              )}

              {/* Current Company */}
              {contact.company && (
                <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                    Current Company
                  </h2>
                  <div className="flex items-center gap-3 p-3 rounded-xl -mx-1">
                    <div className="h-11 w-11 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground flex-shrink-0">
                      <Building className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{contact.company.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[contact.company.industry, contact.company.size ? `${contact.company.size} emp.` : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </section>
              )}
            </div>

            {/* Right column */}
            <div className="lg:col-span-2 space-y-6">
              {/* About */}
              {contact.bio && (
                <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                    About {contact.firstName}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{contact.bio}</p>
                </section>
              )}

              {/* Personal Insights — always locked on public page */}
              <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Personal Insights
                    </h2>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      Online presence — articles, videos, podcasts & more
                    </p>
                  </div>
                  {sortedGroups.length > 0 && (
                    <span className="text-xs bg-secondary px-2.5 py-1 rounded-full font-medium text-muted-foreground">
                      {insights.length} {insights.length === 1 ? "result" : "results"}
                    </span>
                  )}
                </div>
                <PublicLockedSection onLogin={login} variant="insights" />
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
