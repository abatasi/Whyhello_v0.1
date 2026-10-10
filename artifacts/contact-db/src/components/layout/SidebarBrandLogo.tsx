import { darkWordmarkUrl, lightWordmarkUrl, staticMarkLogoUrl } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

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
