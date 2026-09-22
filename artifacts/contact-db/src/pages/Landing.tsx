import { useLocation } from "wouter";
import { Building2, Users, Search, SlidersHorizontal } from "lucide-react";
import whyhelloLogo from "@assets/Untitled_design_1773415520137.png";

export default function Landing() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="w-full px-8 py-5 flex items-center justify-between border-b border-border/40 bg-background">
        <img src={whyhelloLogo} alt="Whyhello" className="h-8 w-auto" />
        <button
          onClick={() => navigate("/sign-in")}
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign in
        </button>
      </header>

      <div className="flex flex-1">
        {/* Left: Hero content */}
        <div className="flex-1 flex flex-col justify-center px-16 py-20 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Contact Intelligence Platform
          </div>

          <h1 className="text-5xl font-display font-bold leading-tight mb-6 text-foreground">
            Find the right people,
            <br />
            <span className="text-primary">faster than ever.</span>
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-md">
            Search and filter millions of professional contacts and companies by industry, seniority, location, and more — all in one place.
          </p>

          {/* Feature highlights */}
          <div className="grid grid-cols-2 gap-4 mb-12">
            {[
              { icon: Search, label: "Smart search across all contacts" },
              { icon: SlidersHorizontal, label: "Multi-criteria filter engine" },
              { icon: Users, label: "Detailed contact profiles" },
              { icon: Building2, label: "Full company intelligence" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Auth buttons */}
          <div className="flex flex-col gap-3 max-w-sm">
            <button
              onClick={() => navigate("/sign-in")}
              className="flex items-center justify-center gap-3 w-full px-5 py-3 bg-background border border-border rounded-xl text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <button
              onClick={() => navigate("/sign-in")}
              className="flex items-center justify-center gap-3 w-full px-5 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              Continue with Email
            </button>

            <p className="text-xs text-center text-muted-foreground mt-2">
              By continuing, you agree to our{" "}
              <span className="underline underline-offset-2 cursor-pointer">Terms of Service</span>{" "}
              and{" "}
              <span className="underline underline-offset-2 cursor-pointer">Privacy Policy</span>.
            </p>
          </div>
        </div>

        {/* Right: Visual panel */}
        <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary/5 via-primary/10 to-indigo-100 items-center justify-center p-16">
          <div className="w-full max-w-sm space-y-3">
            {[
              { name: "Sarah Chen", title: "CTO", company: "Acme Corp", badge: "C-Suite", dept: "Engineering" },
              { name: "Marcus Johnson", title: "VP of Product", company: "Blue Horizon", badge: "VP", dept: "Product" },
              { name: "Priya Patel", title: "Senior Engineer", company: "TechCorp", badge: "IC", dept: "Engineering" },
            ].map((c, i) => (
              <div
                key={c.name}
                className="bg-background rounded-xl p-4 shadow-sm border border-border/50 flex items-center gap-3"
                style={{ opacity: 1 - i * 0.15, transform: `scale(${1 - i * 0.02})` }}
              >
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-100 to-primary/30 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                  {c.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.title} · {c.company}</p>
                </div>
                <span className="text-xs bg-secondary px-2 py-0.5 rounded-full font-medium text-foreground/70 flex-shrink-0">
                  {c.badge}
                </span>
              </div>
            ))}
            <div className="bg-background rounded-xl p-4 shadow-sm border border-border/50 mt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3 h-3" /> Active Filters
              </p>
              <div className="flex flex-wrap gap-2">
                {["C-Suite", "Engineering", "201–500 employees", "San Francisco"].map(f => (
                  <span key={f} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">{f}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
