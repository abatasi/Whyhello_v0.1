import { Link } from "wouter";
import { Database, Search, UserCircle, Settings, Bell } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-gradient-to-br from-primary to-primary/70 p-2 rounded-xl text-white shadow-sm shadow-primary/20 group-hover:shadow-md transition-all duration-300 group-hover:-translate-y-0.5">
              <Database className="h-5 w-5" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Nexus
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-muted-foreground">
            <Link href="/" className="px-4 py-2 rounded-lg bg-secondary/50 text-foreground">
              Directory
            </Link>
            <Button variant="ghost" className="px-4 py-2 rounded-lg">Lists</Button>
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
          <Button variant="ghost" className="flex items-center gap-2 rounded-full pl-2 pr-4 hover:bg-secondary">
            <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs border border-primary/20">
              JD
            </div>
            <span className="text-sm font-medium">Jane Doe</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
