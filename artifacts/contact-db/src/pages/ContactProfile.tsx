import { useRoute, Link } from "wouter";
import { useGetContact } from "@workspace/api-client-react";
import { Shell } from "@/components/layout/Shell";
import { ArrowLeft, Mail, Phone, MapPin, Building, Briefcase, Linkedin, Twitter, Globe } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getInitials } from "@/lib/utils";

export default function ContactProfile() {
  const [, params] = useRoute("/contacts/:id");
  const id = parseInt(params?.id || "0");

  const { data: contact, isLoading, isError } = useGetContact(id, {
    query: { enabled: !!id }
  });

  if (isLoading) {
    return (
      <Shell>
        <div className="p-8 max-w-4xl mx-auto animate-pulse space-y-8">
          <div className="h-10 w-24 bg-muted rounded" />
          <div className="bg-card border rounded-2xl p-8 flex items-start gap-8">
            <div className="w-32 h-32 bg-muted rounded-full" />
            <div className="space-y-4 flex-1">
              <div className="h-8 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-4 bg-muted rounded w-1/4" />
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  if (isError || !contact) {
    return (
      <Shell>
        <div className="p-8 text-center mt-20">
          <h2 className="text-2xl font-bold mb-4">Contact not found</h2>
          <Link href="/"><Button>Back to Search</Button></Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Directory
        </Link>

        <div className="bg-card rounded-3xl shadow-sm border border-border/60 overflow-hidden relative">
          {/* Header Background */}
          <div className="h-32 bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/20 border-b border-border/50 relative overflow-hidden">
             {/* Using abstract image if requested, else gradient fallback */}
             <img src={`${import.meta.env.BASE_URL}images/profile-bg.png`} className="w-full h-full object-cover mix-blend-overlay opacity-50" alt="" />
          </div>
          
          <div className="px-8 pb-8">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Avatar - overlapping header */}
              <div className="-mt-16 relative">
                <div className="h-32 w-32 rounded-full border-4 border-card bg-gradient-to-br from-indigo-100 to-blue-50 flex items-center justify-center text-4xl font-display font-bold text-primary shadow-lg">
                  {getInitials(`${contact.firstName} ${contact.lastName}`)}
                </div>
                {contact.seniority && (
                  <div className="absolute -bottom-2 -right-2 bg-background rounded-full p-1 shadow-sm">
                    <Badge variant="success" className="shadow-sm">{contact.seniority}</Badge>
                  </div>
                )}
              </div>

              {/* Core Info */}
              <div className="flex-1 pt-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-3xl font-display font-bold text-foreground">
                      {contact.firstName} {contact.lastName}
                    </h1>
                    <div className="text-lg text-muted-foreground mt-1 flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      {contact.jobTitle}
                      {contact.department && <span className="text-sm opacity-70">• {contact.department}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Mail className="h-4 w-4" /> Email
                    </Button>
                    {contact.linkedinUrl && (
                      <Button variant="outline" size="sm" className="gap-2 text-[#0A66C2] border-[#0A66C2]/20 hover:bg-[#0A66C2]/10">
                        <Linkedin className="h-4 w-4" /> Connect
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Grid details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-10">
              {/* Left Column: Contact details */}
              <div className="col-span-1 space-y-6">
                <div className="bg-secondary/30 rounded-2xl p-5 border border-border/50">
                  <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Contact Info</h3>
                  <div className="space-y-4">
                    {contact.email && (
                      <div className="flex items-start gap-3">
                        <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Email Address</p>
                          <a href={`mailto:${contact.email}`} className="text-sm text-primary hover:underline">{contact.email}</a>
                        </div>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-start gap-3">
                        <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Phone</p>
                          <a href={`tel:${contact.phone}`} className="text-sm text-muted-foreground hover:text-foreground">{contact.phone}</a>
                        </div>
                      </div>
                    )}
                    {(contact.location || contact.country) && (
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Location</p>
                          <p className="text-sm text-muted-foreground">
                            {[contact.location, contact.country].filter(Boolean).join(", ")}
                          </p>
                        </div>
                      </div>
                    )}
                    {contact.twitterHandle && (
                      <div className="flex items-start gap-3">
                        <Twitter className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Twitter</p>
                          <a href={`https://twitter.com/${contact.twitterHandle.replace('@', '')}`} className="text-sm text-primary hover:underline">
                            {contact.twitterHandle}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Bio & Company */}
              <div className="col-span-1 lg:col-span-2 space-y-6">
                {contact.bio && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">About {contact.firstName}</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {contact.bio}
                    </p>
                  </div>
                )}

                {contact.company && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4">Current Company</h3>
                    <Link href={`/companies/${contact.company.id}`} className="block group">
                      <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="h-14 w-14 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                            <Building className="h-7 w-7" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-lg group-hover:text-primary transition-colors">{contact.company.name}</h4>
                            <div className="text-sm text-muted-foreground flex gap-3 mt-1">
                              {contact.company.industry && <span>{contact.company.industry}</span>}
                              {contact.company.size && <span>• {contact.company.size} employees</span>}
                            </div>
                          </div>
                          <ChevronRightIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m9 18 6-6-6-6"/>
    </svg>
  )
}
