import { useRoute, Link } from "wouter";
import { useGetCompany } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { ArrowLeft, Building2, MapPin, Globe, ExternalLink, Users, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatNumber } from "@/lib/utils";
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

export default function PublicCompanyProfile() {
  const [, params] = useRoute("/companies/:id");
  const id = parseInt(params?.id || "0");
  const { login } = useAuth();

  const { data: company, isLoading, isError } = useGetCompany(id, {
    query: { enabled: !!id },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <PublicHeader onLogin={login} />
        <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse space-y-8">
          <div className="h-10 w-24 bg-muted rounded" />
          <div className="h-64 bg-card border rounded-3xl" />
        </div>
      </div>
    );
  }

  if (isError || !company) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <PublicHeader onLogin={login} />
        <div className="p-8 text-center mt-20">
          <h2 className="text-2xl font-bold mb-4">Company not found</h2>
          <Link href="/"><span className="text-primary underline cursor-pointer">Back to Directory</span></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <PublicHeader onLogin={login} />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link href="/?tab=companies" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Directory
        </Link>

        {/* Company Hero Card — fully visible */}
        <div className="bg-card rounded-3xl shadow-sm border border-border/60 overflow-hidden mb-8">
          <div className="h-24 bg-gradient-to-r from-slate-100 to-indigo-50 border-b border-border/50" />
          <div className="px-8 pb-8">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="-mt-12">
                <div className="h-24 w-24 rounded-2xl bg-white border border-border shadow-sm flex items-center justify-center">
                  <Building2 className="h-10 w-10 text-muted-foreground/50" />
                </div>
              </div>
              <div className="flex-1 pt-2">
                <h1 className="text-3xl font-display font-bold text-foreground mb-2">{company.name}</h1>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {company.industry && <Badge variant="secondary">{company.industry}</Badge>}
                  {company.location && (
                    <span className="flex items-center text-muted-foreground gap-1">
                      <MapPin className="h-4 w-4" /> {company.location}
                    </span>
                  )}
                  {company.website && (
                    <a
                      href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center text-primary hover:underline gap-1"
                    >
                      <Globe className="h-4 w-4" /> {company.website}
                      <ExternalLink className="h-3 w-3 ml-0.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-border">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Company Size</p>
                <p className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" /> {company.size || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Employees</p>
                <p className="font-semibold">{formatNumber(company.employeeCount)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Founded</p>
                <p className="font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" /> {company.foundedYear || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Headquarters</p>
                <p className="font-semibold">{company.country || "N/A"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Wall: blurred preview + sign-in overlay */}
        <div className="relative min-h-[380px]">
          {/* Blurred skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 select-none pointer-events-none blur-sm opacity-40" aria-hidden>
            <div className="col-span-1 lg:col-span-2 space-y-6">
              {company.description && (
                <div className="space-y-3">
                  <div className="h-5 bg-muted rounded w-36" />
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-5/6" />
                  <div className="h-4 bg-muted rounded w-4/5" />
                </div>
              )}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="h-12 bg-muted/40 border-b border-border" />
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 flex items-center gap-4 border-b border-border/50">
                    <div className="h-10 w-10 rounded-full bg-muted flex-shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 bg-muted rounded w-32" />
                      <div className="h-2 bg-muted rounded w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-span-1">
              <div className="bg-secondary/30 rounded-2xl p-6 border border-border/50 space-y-3">
                <div className="h-3 bg-muted rounded w-28" />
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted rounded-lg" />
                ))}
              </div>
            </div>
          </div>

          {/* Gradient fade */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#F8FAFC]/10 via-[#F8FAFC]/60 to-[#F8FAFC] pointer-events-none" />

          {/* Sign-in overlay card */}
          <div className="absolute inset-0 flex items-center justify-center px-4 pt-8">
            <div className="relative z-10 bg-card border border-border rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
              <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                View {company.name}&apos;s full profile
              </h2>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Sign in to access key contacts, company insights, LinkedIn profiles, and more.
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
