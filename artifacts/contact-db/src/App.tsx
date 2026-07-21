import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@workspace/replit-auth-web";

import Search from "@/pages/Search";
import ContactProfile from "@/pages/ContactProfile";
import CompanyProfile from "@/pages/CompanyProfile";
import PublicContactProfile from "@/pages/PublicContactProfile";
import PublicCompanyProfile from "@/pages/PublicCompanyProfile";
import Lists from "@/pages/Lists";
import ListDetail from "@/pages/ListDetail";
import Profile from "@/pages/Profile";
import Login from "@/pages/Login";
import Messages from "@/pages/Messages";
import DNA from "@/pages/DNA";
import MultiThreading from "@/pages/MultiThreading";
import Settings from "@/pages/Settings";
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

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Component />;
}

function ContactProfileRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  return isAuthenticated ? <ContactProfile /> : <PublicContactProfile />;
}

function CompanyProfileRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  return isAuthenticated ? <CompanyProfile /> : <PublicCompanyProfile />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Search} />} />
      <Route path="/contacts/:id" component={ContactProfileRoute} />
      <Route path="/companies/:id" component={CompanyProfileRoute} />
      <Route path="/lists" component={() => <ProtectedRoute component={Lists} />} />
      <Route path="/lists/:id" component={() => <ProtectedRoute component={ListDetail} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
      <Route path="/messages" component={() => <ProtectedRoute component={Messages} />} />
      <Route path="/dna" component={() => <ProtectedRoute component={DNA} />} />
      <Route path="/multithreading" component={() => <ProtectedRoute component={MultiThreading} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
