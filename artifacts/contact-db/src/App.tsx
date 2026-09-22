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
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(226,70%,55%)",
    colorForeground: "hsl(222,47%,11%)",
    colorMutedForeground: "hsl(215,16%,47%)",
    colorDanger: "hsl(0,84%,60%)",
    colorBackground: "hsl(210,33%,99%)",
    colorInput: "hsl(214,32%,91%)",
    colorInputForeground: "hsl(222,47%,11%)",
    colorNeutral: "hsl(214,32%,91%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-card text-card-foreground rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg border border-border/50",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-display font-bold",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground font-medium",
    formFieldLabel: "text-foreground font-medium",
    footerActionLink: "text-primary font-medium hover:text-primary/80",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary hover:text-primary/80",
    formFieldSuccessText: "text-green-600",
    alertText: "text-foreground",
    logoBox: "flex justify-center mb-2",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "border border-border hover:bg-secondary/50 transition-colors",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
    formFieldInput: "border-input bg-background text-foreground focus:ring-2 focus:ring-primary/30",
    footerAction: "border-t border-border/40",
    dividerLine: "bg-border",
    alert: "bg-destructive/10 border border-destructive/20 rounded-lg",
    otpCodeFieldInput: "border-input bg-background text-foreground",
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

function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
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
      <Route path="/directory" component={() => <ProtectedRoute component={Search} />} />
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
          colorBackground: "hsl(var(--background))",
          colorInput: "hsl(var(--input))",
          colorInputForeground: "hsl(var(--foreground))",
          colorNeutral: "hsl(var(--secondary))",
          colorForeground: "hsl(var(--foreground))",
          colorMutedForeground: "hsl(var(--muted-foreground))",
        },
        elements: {
          ...clerkAppearance.elements,
          cardBox: "bg-card text-card-foreground rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg border border-border/50",
          formFieldInput: "border-input bg-background text-foreground focus:ring-2 focus:ring-primary/30",
          otpCodeFieldInput: "border-input bg-background text-foreground",
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
