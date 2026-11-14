import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, Building2, Search, SlidersHorizontal, Users } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

const imageUrl = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/images/business-collaboration.jpg`;

const benefits = [
  {
    number: "01",
    icon: Search,
    title: "Find the right person",
    description: "Search across professional contacts with the context you need to make a relevant introduction.",
  },
  {
    number: "02",
    icon: SlidersHorizontal,
    title: "Make the search yours",
    description: "Narrow by role, seniority, industry, location, and company size. Less noise, more signal.",
  },
  {
    number: "03",
    icon: Building2,
    title: "See the bigger picture",
    description: "Understand the companies behind your contacts before you start the conversation.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <header className="relative z-10 border-b border-border/80 bg-background">
        <div className="mx-auto flex h-[76px] max-w-[1600px] items-center justify-between px-5 sm:px-10 lg:px-16">
          <Link href="/" data-testid="link-landing-home" className="inline-flex items-center no-underline">
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-3 sm:gap-7">
            <Link href="/sign-in" data-testid="link-landing-signin" className="text-sm font-semibold text-foreground no-underline transition-opacity hover:opacity-65">Sign in</Link>
            <Link href="/sign-up" data-testid="link-landing-signup" style={{ color: "hsl(var(--primary-foreground))" }} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground no-underline transition-opacity hover:opacity-90 sm:px-5">
              Get started <ArrowUpRight size={15} strokeWidth={2} />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1600px] lg:min-h-[690px] lg:grid-cols-[minmax(0,48%)_minmax(0,52%)]">
          <div className="flex flex-col justify-center px-6 pb-14 pt-16 sm:px-10 lg:px-16 lg:py-20 xl:px-24">
            <div className="mb-8 inline-flex w-fit items-center gap-2.5 rounded-full border border-border bg-secondary/50 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.15em] text-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              Contact intelligence, made human
            </div>
            <h1 data-testid="text-landing-headline" className="max-w-[680px] text-[clamp(3.35rem,5.7vw,6.35rem)] font-bold leading-[0.99] tracking-[-0.07em] text-foreground">
              Better business starts with <span className="text-primary">better hello.</span>
            </h1>
            <p className="mt-8 max-w-[470px] text-[17px] leading-[1.75] text-muted-foreground sm:text-[18px]">
              Find the people who matter, understand the context behind every connection, and turn a first hello into something meaningful.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/sign-up" data-testid="link-hero-signup" style={{ color: "hsl(var(--primary-foreground))" }} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground no-underline transition-opacity hover:opacity-90">
                Start connecting <ArrowRight size={17} strokeWidth={2} />
              </Link>
              <Link href="/sign-in" data-testid="link-hero-signin" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border bg-card px-6 text-sm font-semibold text-foreground no-underline transition-colors hover:bg-secondary">
                I have an account
              </Link>
            </div>
            <div className="mt-12 flex items-center gap-3 border-t border-border pt-6 text-xs font-medium text-muted-foreground">
              <Users size={17} strokeWidth={1.7} className="text-primary" />
              A more considered way to grow your network.
            </div>
          </div>

          <div className="relative min-h-[460px] overflow-hidden bg-[#26343a] sm:min-h-[550px] lg:min-h-full">
            <img src={imageUrl} alt="Business colleagues collaborating around a meeting table" className="absolute inset-0 h-full w-full object-cover object-center" />
            <div className="absolute bottom-5 left-5 right-5 max-w-[385px] rounded-xl border border-white/15 bg-[#172b34]/95 p-5 text-[#f7f7f2] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)] sm:bottom-9 sm:left-9 sm:p-6 lg:bottom-12 lg:left-12">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b9d3dc]">The right connection</span>
                <span className="flex size-8 items-center justify-center rounded-full border border-white/20 text-[#e4eff1]"><ArrowUpRight size={15} /></span>
              </div>
              <p className="text-[20px] font-semibold leading-[1.3] tracking-[-0.035em] sm:text-[24px]">Know who you&apos;re talking to. Know why it matters.</p>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-white/20 pt-4">
                {["People", "Companies", "Context"].map((item) => (
                  <span key={item} className="rounded-md bg-[#dce9e9] px-2.5 py-1 text-[11px] font-bold text-[#17343c]">{item}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto grid max-w-[1600px] gap-8 px-6 py-9 sm:grid-cols-[1fr_auto] sm:items-center sm:px-10 lg:px-16 xl:px-24">
            <p className="max-w-[660px] text-[18px] font-semibold leading-snug tracking-[-0.03em] text-foreground sm:text-[21px]">
              A name is a starting point. The right context is what moves a relationship forward.
            </p>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Search with purpose, connect with confidence</span>
          </div>
        </section>

        <section className="mx-auto max-w-[1600px] px-6 py-20 sm:px-10 lg:px-16 lg:py-28 xl:px-24">
          <div className="max-w-[660px]">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">How it works</span>
            <h2 className="mt-4 text-[clamp(2.2rem,4vw,4rem)] font-bold leading-[1.08] tracking-[-0.06em] text-foreground">From who to why, in a few thoughtful steps.</h2>
          </div>
          <div className="mt-12 grid border-t border-border md:grid-cols-3">
            {benefits.map(({ number, icon: Icon, title, description }, index) => (
              <div key={number} className={`border-b border-border px-1 py-8 md:border-b-0 md:px-7 md:py-10 ${index > 0 ? "md:border-l" : "md:pl-0"}`}>
                <div className="flex items-start justify-between">
                  <span className="flex size-11 items-center justify-center rounded-lg bg-secondary text-primary"><Icon size={21} strokeWidth={1.8} /></span>
                  <span className="font-mono text-xs text-muted-foreground">{number} / 03</span>
                </div>
                <h3 className="mt-8 text-[22px] font-bold tracking-[-0.035em] text-foreground">{title}</h3>
                <p className="mt-3 max-w-[330px] text-sm leading-7 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#172b34] px-6 py-20 text-[#f5f6f0] sm:px-10 lg:px-16 lg:py-24">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-9 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b2d0da]">The next conversation starts here</span>
              <h2 className="mt-5 max-w-[720px] text-[clamp(2.5rem,5vw,5.5rem)] font-bold leading-[1.04] tracking-[-0.065em] text-[#f5f6f0]">Make the first hello count.</h2>
            </div>
            <Link href="/sign-up" data-testid="link-footer-signup" style={{ color: "#17343c" }} className="inline-flex min-h-12 w-fit shrink-0 items-center gap-4 rounded-lg bg-[#e5eeee] px-6 text-sm font-bold text-[#17343c] no-underline transition-opacity hover:opacity-85">
              Get started <ArrowUpRight size={17} />
            </Link>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-3 border-t border-border px-6 py-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-16">
        <span>
          <BrandLogo size="footer" />
        </span>
        <span>© {new Date().getFullYear()} Whyhello. Relationships worth building.</span>
      </footer>
    </div>
  );
}