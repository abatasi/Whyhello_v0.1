import { useRoute, Link, useLocation } from "wouter";
import { useGetCompany } from "@workspace/api-client-react";
import { ArrowLeft, Building2, MapPin, Globe, ExternalLink, Users, Calendar, Linkedin } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { getInitials, formatNumber } from "@/lib/utils";
import BrandLogo from "@/components/BrandLogo";

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
          <BrandLogo size="footer" />
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
  const [, navigate] = useLocation();
  const login = () => navigate("/sign-in");

  const { data: company, isLoading, isError } = useGetCompany(id, {
    query: { enabled: !!id },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
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
      <div className="min-h-screen bg-background">
        <PublicHeader onLogin={login} />
        <div className="p-8 text-center mt-20">
          <h2 className="text-2xl font-bold mb-4">Company not found</h2>
          <Link href="/"><span className="text-primary underline cursor-pointer">Back to Directory</span></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader onLogin={login} />

      {/* Dark overlay below header — dims all content */}
      <div className="fixed left-0 right-0 bottom-0 top-16 z-10 bg-black/50 pointer-events-none" />

      {/* Sign-in card — fixed center of viewport below header */}
      <div className="fixed left-0 right-0 bottom-0 top-16 z-20 flex items-center justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto bg-card dark:bg-background border border-border rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Building2 className="h-7 w-7 text-muted-foreground" />
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

      {/* Full company profile content — rendered but dimmed beneath overlay */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link href="/?tab=companies" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Directory
        </Link>

        {/* Company Hero Card */}
        <div className="bg-card dark:bg-background rounded-3xl shadow-sm border border-border/60 overflow-hidden mb-8">
          <div className="h-24 bg-gradient-to-r from-slate-100 to-indigo-50 border-b border-border/50 dark:bg-none dark:bg-background" />
          <div className="px-8 pb-8">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="-mt-12">
                <div className="h-24 w-24 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-center">
                  <Building2 className="h-10 w-10 text-muted-foreground/50" />
                </div>
              </div>
              <div className="flex-1 pt-2 flex justify-between items-start w-full">
                <div>
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
                {company.linkedinUrl && (
                  <a
                    href={company.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-shrink-0"
                  >
                    <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#0A66C2]/20 text-[#0A66C2] dark:border-blue-500/20 dark:text-blue-400 text-sm font-medium hover:bg-[#0A66C2]/10 dark:hover:bg-blue-500/10 transition-colors">
                      <Linkedin className="h-4 w-4" /> Follow
                    </span>
                  </a>
                )}
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

        {/* Content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left col: Description + Contacts */}
          <div className="col-span-1 lg:col-span-2 space-y-8">
            {company.description && (
              <section>
                <h2 className="text-xl font-bold mb-4">About {company.name}</h2>
                <div className="prose prose-sm max-w-none text-muted-foreground">
                  <p className="leading-relaxed text-base">{company.description}</p>
                </div>
              </section>
            )}

            {/* Key Contacts */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Key Contacts</h2>
                <Badge variant="outline">{company.contacts?.length || 0} employees found</Badge>
              </div>
              <div className="bg-card dark:bg-background border border-border rounded-xl overflow-hidden shadow-sm">
                {(!company.contacts || company.contacts.length === 0) ? (
                  <div className="p-8 text-center text-muted-foreground">No contacts found for this company.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {company.contacts.map((contact) => (
                      <div key={contact.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                            {getInitials(`${contact.firstName} ${contact.lastName}`)}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{contact.firstName} {contact.lastName}</p>
                            <p className="text-sm text-muted-foreground">{contact.jobTitle}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          {contact.department && (
                            <span className="text-muted-foreground hidden sm:inline-block">{contact.department}</span>
                          )}
                          {contact.seniority && (
                            <Badge variant="outline" className="hidden md:inline-flex">{contact.seniority}</Badge>
                          )}
                          <button
                            onClick={login}
                            className="h-8 px-3 rounded-md text-xs font-medium border border-border hover:bg-secondary/50 transition-colors"
                          >
                            View Profile
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right col: Similar Companies */}
          <div className="col-span-1">
            <div className="bg-secondary/30 dark:bg-background rounded-2xl p-6 border border-border/50 sticky top-24">
              <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Similar Companies</h3>
              <div className="text-sm text-muted-foreground text-center py-8">
                Data enrichment required to view competitors.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
