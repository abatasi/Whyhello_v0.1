import "./_group.css";

import { useState } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Command,
  FileUp,
  Gauge,
  Globe2,
  Layers3,
  ListFilter,
  Map,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  UserRound,
  Zap,
} from "lucide-react";

type IconType = typeof Users;

const routes: { label: string; icon: IconType; active?: boolean }[] = [
  { label: "Directory", icon: Users, active: true },
  { label: "Message Center", icon: MessageSquare },
  { label: "Playbooks", icon: ClipboardList },
  { label: "Multi-threading", icon: Layers3 },
];

const moreRoutes: { label: string; icon: IconType }[] = [
  { label: "Lists", icon: ListFilter },
  { label: "Industries", icon: Building2 },
  { label: "Roles", icon: BriefcaseBusiness },
  { label: "Import", icon: Upload },
  { label: "Roadmap", icon: Map },
];

function LogoMark() {
  return (
    <span className="wh-logo-mark" aria-label="Whyhello">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 5.5 7.3 18l4.7-8.7 4.7 8.7 3.8-12.5" />
      </svg>
    </span>
  );
}

function DirectoryPage() {
  const people = [
    ["Maya Chen", "VP Growth", "Vanta", "Warm"],
    ["Jon Bell", "Head of RevOps", "Linear", "Active"],
    ["Priya Nair", "Chief of Staff", "Ramp", "Warm"],
    ["Owen Wright", "VP Sales", "Retool", "New"],
  ];

  return (
    <main className="wh-page">
      <div className="wh-topbar">
        <div className="wh-topbar-spacer" />
        <div className="wh-topbar-tools">
          <button className="wh-hq-pill" aria-label="HQ mode">
            <Gauge size={14} />
            <span>HQ</span>
            <i />
            <ShieldCheck size={14} />
            <span>Peacetime</span>
            <ChevronDown size={13} />
          </button>
          <span className="wh-credit"><Zap size={13} /> 2,840 <em>credits</em></span>
          <button className="wh-icon-button" aria-label="Global search"><Search size={18} /></button>
          <button className="wh-profile" aria-label="Open profile"><span>AC</span><ChevronDown size={13} /></button>
        </div>
      </div>
      <section className="wh-content">
        <div className="wh-breadcrumb"><span>Workspace</span><b>/</b><strong>Directory</strong></div>
        <div className="wh-heading-row">
          <div>
            <p className="wh-eyebrow">Relationship intelligence</p>
            <h1>Directory</h1>
            <p className="wh-subtitle">Your team&apos;s living map of people and companies.</p>
          </div>
          <button className="wh-primary"><Sparkles size={15} /> Enrich contacts</button>
        </div>
        <div className="wh-metrics">
          <div><span>Total people</span><strong>18,492</strong><small>↑ 4.8% this month</small></div>
          <div><span>Companies</span><strong>3,218</strong><small>↑ 126 added recently</small></div>
          <div><span>Signals this week</span><strong>247</strong><small>↑ 18.2% vs last week</small></div>
        </div>
        <div className="wh-list-card">
          <div className="wh-list-head">
            <div><h2>People</h2><span className="wh-count">18,492</span></div>
            <div className="wh-list-actions"><button><ListFilter size={14} /> Filter</button><button><ArrowUpRight size={14} /> Export</button></div>
          </div>
          <div className="wh-table-head"><span>Person</span><span>Company</span><span>Relationship</span><span>Last signal</span></div>
          {people.map(([name, role, company, signal]) => (
            <div className="wh-person-row" key={name}>
              <div className="wh-person"><span className="wh-avatar">{name.split(" ").map((n) => n[0]).join("")}</span><div><strong>{name}</strong><small>{role}</small></div></div>
              <span className="wh-company"><Building2 size={14} /> {company}</span>
              <span className={`wh-status wh-status-${signal.toLowerCase()}`}><i /> {signal}</span>
              <span className="wh-last">Today, 9:42 AM</span>
            </div>
          ))}
        </div>
      </section>
      <aside className="wh-help"><CircleHelp size={15} /> Need a hand?</aside>
    </main>
  );
}

function MasterSidebar() {
  const [expanded, setExpanded] = useState(false);
  const handleBlur = () => window.setTimeout(() => {
    if (!document.querySelector(".wh-master-sidebar:focus-within")) setExpanded(false);
  }, 0);

  return (
    <aside
      className={`wh-master-sidebar ${expanded ? "is-expanded" : ""}`}
      aria-label="Whyhello primary navigation"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocusCapture={() => setExpanded(true)}
      onBlurCapture={handleBlur}
    >
      <div className="wh-sidebar-inner">
        <div className="wh-brand-row">
          <button className="wh-brand-button" aria-label="Whyhello home"><LogoMark /><span>whyhello</span></button>
          {expanded && <span className="wh-collapse-hint">hover away to collapse</span>}
        </div>
        <nav className="wh-route-nav">
          {routes.map(({ label, icon: Icon, active }) => (
            <button key={label} className={`wh-route ${active ? "is-active" : ""}`} aria-label={label} title={!expanded ? label : undefined}>
              <Icon size={18} strokeWidth={active ? 2.3 : 1.85} />
              <span>{label}</span>
              {active && expanded && <i className="wh-active-dot" />}
            </button>
          ))}
          <div className="wh-more-header"><span>More</span></div>
          {moreRoutes.map(({ label, icon: Icon }) => (
            <button key={label} className="wh-route wh-subroute" aria-label={label} title={!expanded ? label : undefined}>
              <Icon size={18} strokeWidth={1.85} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="wh-sidebar-bottom">
          <button className="wh-route" title={!expanded ? "Command menu" : undefined} aria-label="Command menu"><Command size={18} /><span>Command menu</span><kbd>⌘K</kbd></button>
          <button className="wh-route" title={!expanded ? "Profile" : undefined} aria-label="Profile"><UserRound size={18} /><span>Profile</span></button>
        </div>
      </div>
    </aside>
  );
}

export function SidebarNavigation() {
  return (
    <div className="whyhello-nav-demo min-h-screen">
      <MasterSidebar />
      <DirectoryPage />
    </div>
  );
}