import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppModeProvider } from "@/contexts/AppModeContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useTheme } from "next-themes";
import { dark } from "@clerk/themes";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  Show,
  useAuth,
  useClerk,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Link } from "wouter";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import BrandLogo, { markLogoUrl } from "@/components/BrandLogo";
import AuthPhotoRotation from "@/components/AuthPhotoRotation";

import Search from "@/pages/Search";
import Home from "@/pages/Home";
import Landing from "@/pages/Landing";
import ContactProfile from "@/pages/ContactProfile";
import CompanyProfile from "@/pages/CompanyProfile";
import PublicContactProfile from "@/pages/PublicContactProfile";
import PublicCompanyProfile from "@/pages/PublicCompanyProfile";
import Lists from "@/pages/Lists";
import ListDetail from "@/pages/ListDetail";
import Profile from "@/pages/Profile";
import Messages from "@/pages/Messages";
import HQ from "@/pages/HQ";
import MultiThreading from "@/pages/MultiThreading";
import Settings from "@/pages/Settings";
import Import from "@/pages/Import";
import Industries from "@/pages/Industries";
import IndustryDetail from "@/pages/IndustryDetail";
import Roles from "@/pages/Roles";
import RoleDetail from "@/pages/RoleDetail";
import Playbooks from "@/pages/Playbooks";
import Roadmap from "@/pages/Roadmap";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname so the
// same build serves multiple Clerk custom domains.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev (Clerk hits dev FAPI directly), auto-set
// in prod. Do NOT gate on import.meta.env.PROD / NODE_ENV.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const absoluteLogoUrl = (url: string) => new URL(url, window.location.origin).href;

// Clerk passes full paths to routerPush/routerReplace, but wouter's
// setLocation prepends the base — strip it to avoid doubling.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: absoluteLogoUrl(markLogoUrl),
  },
  variables: {
    colorPrimary: "hsl(var(--primary))",
    colorForeground: "hsl(var(--foreground))",
    colorMutedForeground: "hsl(var(--muted-foreground))",
    colorDanger: "hsl(var(--destructive))",
    colorBackground: "hsl(var(--card))",
    colorInput: "hsl(var(--secondary))",
    colorInputForeground: "hsl(var(--foreground))",
    colorNeutral: "hsl(var(--border))",
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: "0.625rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "!bg-card dark:!bg-slate-800 !text-card-foreground rounded-2xl w-[440px] max-w-full overflow-hidden border border-border dark:!border-slate-500 shadow-[0_20px_70px_-35px_rgba(20,31,51,0.35)]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "!text-foreground !font-bold !tracking-tight",
    headerSubtitle: "!text-muted-foreground",
    socialButtonsBlockButtonText: "!text-foreground !font-semibold",
    formFieldLabel: "!text-foreground !font-semibold",
    footerActionLink: "!text-primary !font-semibold hover:!opacity-80",
    footerActionText: "!text-muted-foreground",
    dividerText: "!text-muted-foreground",
    identityPreviewEditButton: "!text-primary",
    formFieldSuccessText: "!text-foreground",
    alertText: "!text-foreground",
    logoBox: "flex justify-center mb-2 pt-2",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "!bg-card dark:!bg-slate-800 !border !border-border dark:!border-slate-500 !text-foreground hover:!bg-secondary transition-colors",
    formButtonPrimary: "!bg-primary !text-primary-foreground hover:!opacity-90 transition-opacity",
    formFieldInput: "!border-border dark:!border-slate-500 !bg-secondary dark:!bg-slate-950 !text-foreground placeholder:!text-muted-foreground focus:!ring-2 focus:!ring-primary/30",
    footerAction: "!border-t !border-border",
    dividerLine: "!bg-border",
    alert: "!bg-secondary !border !border-border rounded-lg",
    otpCodeFieldInput: "!border-border dark:!border-slate-500 !bg-secondary dark:!bg-slate-950 !text-foreground",
    formFieldRow: "gap-2",
    main: "gap-4",
  },
};

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingSpinner />;
  // Signed-out users see the public landing page — never redirect to /sign-in from home.
  if (!isSignedIn) return <Landing />;
  return <Home />;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingSpinner />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <Component />;
}

function ContactProfileRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingSpinner />;
  return isSignedIn ? <ContactProfile /> : <PublicContactProfile />;
}

function CompanyProfileRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingSpinner />;
  return isSignedIn ? <CompanyProfile /> : <PublicCompanyProfile />;
}

function AuthPageShell({ children, isSignUp }: { children: React.ReactNode; isSignUp: boolean }) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="mx-auto flex min-h-[100dvh] max-w-[1800px] flex-col lg:flex-row">
        <main className="flex min-h-[100dvh] w-full flex-col px-5 sm:px-10 lg:w-[53%] lg:px-14 xl:px-20">
          <div className="flex items-center justify-between border-b border-border/70 py-6">
            <Link href="/" data-testid="link-auth-home" className="inline-flex items-center no-underline">
              <BrandLogo />
            </Link>
            <Link href="/" data-testid="link-auth-back" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground no-underline hover:text-foreground">
              <ArrowLeft size={15} strokeWidth={1.8} /> Back to home
            </Link>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center py-12 sm:py-16">
            <div className="mb-8 w-full max-w-[440px] px-1">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">
                <span className="size-1.5 rounded-full bg-primary" /> Your relationship workspace
              </div>
              <h1 className="text-[clamp(2rem,3.3vw,3rem)] leading-[1.1] tracking-[-0.055em] font-bold text-foreground">
                {isSignUp ? "Make every introduction count." : "Good to see you again."}
              </h1>
              <p className="mt-3 max-w-[370px] text-[15px] leading-7 text-muted-foreground">
                {isSignUp ? "Start building a more thoughtful way to find and know the people behind your next opportunity." : "The people, context, and connections that matter are right where you left them."}
              </p>
            </div>
            {children}
            <p className="mt-9 max-w-[440px] text-center text-xs leading-5 text-muted-foreground">
              A better way to keep the right conversations moving.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border/70 py-5 text-[11px] text-muted-foreground">
            <span>© {new Date().getFullYear()} Whyhello</span>
            <span>Built for better business relationships.</span>
          </div>
        </main>
        <aside className="relative hidden min-h-[100dvh] flex-1 overflow-hidden bg-[#25323b] lg:block">
          <AuthPhotoRotation />
          <div className="absolute bottom-8 left-8 right-8 max-w-[500px] rounded-2xl border border-white/20 bg-[#14242e]/95 px-8 py-8 text-[#f4f4ee] shadow-xl xl:bottom-12 xl:left-12 xl:right-12 xl:px-10 xl:py-10">
            <span className="mb-5 block text-[11px] font-bold uppercase tracking-[0.2em] text-[#c0d1df]">The Whyhello perspective</span>
            <p className="text-[clamp(1.6rem,2.5vw,2.45rem)] font-medium leading-[1.22] tracking-[-0.045em]">
              The best opportunities start with a real conversation.
            </p>
            <div className="mt-7 flex items-center gap-2 border-t border-white/20 pt-5 text-xs font-semibold text-[#e6edf0]">
              Find your people <ArrowUpRight size={15} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SignInPage() {
  return (
    <AuthPageShell isSignUp={false}>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </AuthPageShell>
  );
}

function SignUpPage() {
  return (
    <AuthPageShell isSignUp>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </AuthPageShell>
  );
}

// Invalidate the query cache when the signed-in user changes.
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function Router() {
  return (
    <Switch>
      {/* Redirect old /login path to /sign-in */}
      <Route path="/login" component={() => <Redirect to="/sign-in" />} />
      {/* REQUIRED — copy "/sign-in/*?" and "/sign-up/*?" verbatim */}
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/" component={HomeRoute} />
      <Route path="/directory/people" component={() => <ProtectedRoute component={() => <Search directory="contacts" />} />} />
      <Route path="/directory/companies" component={() => <ProtectedRoute component={() => <Search directory="companies" />} />} />
      <Route path="/directory" component={() => {
        const params = new URLSearchParams(window.location.search);
        const destination = params.get("tab") === "companies" ? "companies" : "people";
        params.delete("tab");
        const query = params.toString();
        return <Redirect to={`/directory/${destination}${query ? `?${query}` : ""}`} />;
      }} />
      <Route path="/contacts/:id" component={ContactProfileRoute} />
      <Route path="/companies/:id" component={CompanyProfileRoute} />
      <Route path="/lists" component={() => <ProtectedRoute component={Lists} />} />
      <Route path="/lists/:id" component={() => <ProtectedRoute component={ListDetail} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
      <Route path="/messages" component={() => <ProtectedRoute component={Messages} />} />
      <Route path="/hq" component={() => <ProtectedRoute component={HQ} />} />
      <Route path="/multithreading" component={() => <ProtectedRoute component={MultiThreading} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route path="/import" component={() => <ProtectedRoute component={Import} />} />
      <Route path="/industries" component={() => <ProtectedRoute component={Industries} />} />
      <Route path="/industries/:id" component={() => <ProtectedRoute component={IndustryDetail} />} />
      <Route path="/roles" component={() => <ProtectedRoute component={Roles} />} />
      <Route path="/roles/:id" component={() => <ProtectedRoute component={RoleDetail} />} />
      <Route path="/playbooks" component={() => <ProtectedRoute component={Playbooks} />} />
      <Route path="/playbooks/:id" component={() => <ProtectedRoute component={Playbooks} />} />
      <Route path="/roadmap" component={() => <ProtectedRoute component={Roadmap} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const { resolvedTheme } = useTheme();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={{
        ...clerkAppearance,
        theme: resolvedTheme === "dark" ? [shadcn, dark] : shadcn,
        variables: {
          ...clerkAppearance.variables,
          colorBackground: "hsl(var(--card))",
          colorInput: "hsl(var(--secondary))",
          colorInputForeground: "hsl(var(--foreground))",
          colorNeutral: "hsl(var(--border))",
          colorForeground: "hsl(var(--foreground))",
          colorMutedForeground: "hsl(var(--muted-foreground))",
          colorPrimary: "hsl(var(--primary))",
        },
        elements: {
          ...clerkAppearance.elements,
        }
      }}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      afterSignOutUrl={basePath || "/"}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to access your account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Get started with Whyhello today",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <WouterRouter base={basePath}>
        <AppModeProvider>
          <ClerkProviderWithRoutes />
        </AppModeProvider>
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
