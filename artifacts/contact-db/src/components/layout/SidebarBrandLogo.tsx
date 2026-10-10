import { darkWordmarkUrl, lightWordmarkUrl, staticMarkLogoUrl } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

export function SidebarBrandRow({ expanded, darkTheme, wartime = false, onSearch }: {
  expanded: boolean; darkTheme: boolean; wartime?: boolean; onSearch: () => void;
}) {
  return <div className="master-brand-row">
    <SidebarBrandLogo expanded={expanded} darkTheme={darkTheme} wartime={wartime} />
    {expanded && <button type="button" className="sidebar-search-trigger" onClick={onSearch}
      aria-label="Open search in focus mode" aria-haspopup="dialog" aria-controls="global-search-focus-dialog"
      title="Search" data-testid="button-sidebar-search">
      <Search size={17} aria-hidden="true" />
    </button>}
  </div>;
}

export function SidebarBrandLogo({ expanded, darkTheme, wartime = false }: {
  expanded: boolean;
  darkTheme: boolean;
  wartime?: boolean;
}) {
  return <div className="sidebar-logo-menu relative flex shrink-0 items-center" role="img" aria-label="Whyhello" data-testid="sidebar-brand-logo">
    <div className={cn("sidebar-logo-trigger", wartime ? "bg-transparent" : "bg-background")} aria-hidden="true">
      <div className={cn("sidebar-logo-crop", expanded && "sidebar-logo-crop-expanded")}>
        <img src={staticMarkLogoUrl} alt="" className="sidebar-static-mark" />
      </div>
    </div>
    <span className="sidebar-wordmark" aria-hidden="true">
      <img src={darkTheme ? darkWordmarkUrl : lightWordmarkUrl} alt="" width={345} height={84} />
    </span>
  </div>;
}
