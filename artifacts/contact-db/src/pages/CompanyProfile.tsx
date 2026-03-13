import { useRoute, Link } from "wouter";
import { useGetCompany } from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { ArrowLeft, Building2, MapPin, Users, Globe, ExternalLink, Linkedin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getInitials, formatNumber } from "@/lib/utils";

export default function CompanyProfile() {
  const [, params] = useRoute("/companies/:id");
  const id = parseInt(params?.id || "0");

  const { data: company, isLoading, isError } = useGetCompany(id, {
    query: { enabled: !!id }
  });

  if (isLoading) {
    return (
      <Shell>
        <div className="p-8 max-w-5xl mx-auto animate-pulse space-y-8">
          <div className="h-10 w-24 bg-muted rounded" />
          <div className="h-64 bg-card border rounded-3xl" />
        </div>
      </Shell>
    );
  }

  if (isError || !company) {
    return (
      <Shell>
        <div className="p-8 text-center mt-20">
          <h2 className="text-2xl font-bold mb-4">Company not found</h2>
          <Link href="/"><Button>Back to Search</Button></Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link href="/?tab=companies" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Directory
        </Link>

        {/* Company Header Card */}
        <div className="bg-card rounded-3xl shadow-sm border border-border/60 overflow-hidden mb-8">
           <div className="h-24 bg-gradient-to-r from-slate-100 to-indigo-50 border-b border-border/50"></div>
           <div className="px-8 pb-8">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="-mt-12">
                  <div className="h-24 w-24 rounded-2xl bg-white border border-border shadow-sm flex items-center justify-center">
                    <Building2 className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                </div>
                <div className="flex-1 pt-2 flex justify-between items-start w-full">
                  <div>
                    <h1 className="text-3xl font-display font-bold text-foreground mb-2">{company.name}</h1>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      {company.industry && <Badge variant="secondary">{company.industry}</Badge>}
                      {company.location && (
                        <span className="flex items-center text-muted-foreground gap-1"><MapPin className="h-4 w-4" /> {company.location}</span>
                      )}
                      {company.website && (
                         <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer" className="flex items-center text-primary hover:underline gap-1">
                           <Globe className="h-4 w-4" /> {company.website} <ExternalLink className="h-3 w-3 ml-0.5" />
                         </a>
                      )}
                    </div>
                  </div>
                  {company.linkedinUrl && (
                    <Button variant="outline" size="sm" className="gap-2 text-[#0A66C2] border-[#0A66C2]/20 hover:bg-[#0A66C2]/10">
                      <Linkedin className="h-4 w-4" /> Follow
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-border">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Company Size</p>
                  <p className="font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> {company.size || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Employees</p>
                  <p className="font-semibold">{formatNumber(company.employeeCount)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Founded</p>
                  <p className="font-semibold flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> {company.foundedYear || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Headquarters</p>
                  <p className="font-semibold">{company.country || 'N/A'}</p>
                </div>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Left Col: Description */}
           <div className="col-span-1 lg:col-span-2 space-y-8">
              {company.description && (
                <section>
                  <h2 className="text-xl font-bold mb-4">About {company.name}</h2>
                  <div className="prose prose-sm max-w-none text-muted-foreground">
                    <p className="leading-relaxed text-base">{company.description}</p>
                  </div>
                </section>
              )}

              {/* Contacts Table */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Key Contacts</h2>
                  <Badge variant="outline">{company.contacts?.length || 0} employees found</Badge>
                </div>
                
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  {(!company.contacts || company.contacts.length === 0) ? (
                    <div className="p-8 text-center text-muted-foreground">No contacts found for this company.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {company.contacts.map((contact) => (
                        <Link key={contact.id} href={`/contacts/${contact.id}`} className="block hover:bg-muted/50 transition-colors">
                          <div className="p-4 flex items-center justify-between">
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
                               {contact.department && <span className="text-muted-foreground hidden sm:inline-block">{contact.department}</span>}
                               {contact.seniority && <Badge variant="outline" className="hidden md:inline-flex">{contact.seniority}</Badge>}
                               <Button variant="ghost" size="sm" className="h-8">View Profile</Button>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>
           </div>

           {/* Right Col: Sidebar info if any */}
           <div className="col-span-1">
              <div className="bg-secondary/30 rounded-2xl p-6 border border-border/50 sticky top-24">
                <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Similar Companies</h3>
                <div className="text-sm text-muted-foreground text-center py-8">
                   Data enrichment required to view competitors.
                </div>
              </div>
           </div>
        </div>
      </div>
    </Shell>
  );
}
