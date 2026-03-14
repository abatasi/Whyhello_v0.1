import { Link, useLocation } from "wouter";
import { Search, Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@workspace/replit-auth-web";
import whyhelloLogo from "@assets/Untitled_design_1773415520137.png";
import { cn } from "@/lib/utils";

function getInitials(firstName?: string | null, lastName?: string | null): string {
  const f = firstName?.[0] ?? "";
  const l = lastName?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

export function Navbar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const navItems = [
    { label: "Directory", href: "/" },
    { label: "Lists", href: "/lists" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center">
            <img src={whyhelloLogo} alt="Whyhello" className="h-8 w-auto" />
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-muted-foreground">
            {navItems.map((item) => {
              const isActive = item.href === "/"
                ? location === "/" || location === ""
                : location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-4 py-2 rounded-lg transition-colors",
                    isActive
                      ? "bg-secondary/50 text-foreground"
                      : "hover:bg-secondary/30 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <Button variant="ghost" className="px-4 py-2 rounded-lg">Enrichment</Button>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-full">
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-5 w-5" />
          </Button>
          <div className="h-8 w-px bg-border mx-2" />
          <div className="flex items-center gap-2">
            {user?.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt="Profile"
                className="h-7 w-7 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs border border-primary/20">
                {getInitials(user?.firstName, user?.lastName)}
              </div>
            )}
            <span className="text-sm font-medium hidden md:block">
              {user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : (user?.email ?? "Account")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-muted-foreground hover:text-foreground ml-1"
              onClick={logout}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
