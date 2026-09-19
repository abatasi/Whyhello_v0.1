import "./_group.css";

import { useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ClipboardList,
  Command,
  Gauge,
  Home,
  Layers3,
  ListFilter,
  Map,
  MessageSquare,
  Network,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Upload,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";

type IconType = typeof Users;

const routes: { label: string; icon: IconType; active?: boolean }[] = [
  { label: "Home", icon: Home, active: true },
  { label: "Directory", icon: Users },
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
      <img src="/__mockup/images/sidebar-navigation-whyhello-logo.png" alt="" />
    </span>
  );
}

function HomePage() {
  const leads = [
    { name: "Maya Chen", score: 96, email: "maya.chen@vanta.com", title: "VP Growth", company: "Vanta", location: "San Francisco, CA" },
    { name: "Jon Bell", score: 88, email: "Access Email", title: "Head of RevOps", company: "Linear", location: "San Francisco, CA" },
    { name: "Priya Nair", score: 73, email: "priya.nair@ramp.com", title: "Chief of Staff", company: "Ramp", location: "New York, NY" },
    { name: "Owen Wright", score: 61, email: "Access Email", title: "VP Sales", company: "Retool", location: "New York, NY" },
    { name: "Sofia Alvarez", score: 47, email: "sofia.alvarez@figma.com", title: "Director, Partnerships", company: "Figma", location: "London, UK" },
  ];

  const scoreMeta = (score: number) => {
    if (score >= 90) return { label: "Excellent", className: "excellent" };
    if (score >= 75) return { label: "Strong", className: "strong" };
    if (score >= 50) return { label: "Potential", className: "potential" };
    return { label: "Low Fit", className: "low-fit" };
  };

  const activity = [
    {
      icon: Send,
      tone: "purple",
      title: "Single message created",
      detail: "For Maya Chen · VP Growth at Vanta",
      time: "3h ago",
    },
    {
      icon: UserCheck,
      tone: "green",
      title: "Contact activated",
      detail: "Jon Bell · Head of RevOps at Linear",
      time: "Yesterday",
    },
    {
      icon: SlidersHorizontal,
      tone: "blue",
      title: "HQ elements updated",
      detail: "Buying triggers and positioning",
      time: "Yesterday",
    },
    {
      icon: ClipboardList,
      tone: "amber",
      title: "Playbook built",
      detail: "Enterprise expansion · 6 steps",
      time: "3 days ago",
    },
    {
      icon: Network,
      tone: "rose",
      title: "Buying center built",
      detail: "Ramp · 8 contacts across 4 roles",
      time: "Last week",
    },
    {
      icon: Target,
      tone: "slate",
      title: "Ideal Customer Profile built",
      detail: "Series B fintech leaders",
      time: "Last week",
    },
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
        </div>
      </div>
      <section className="wh-content">
        <div className="wh-heading-row">
          <h1>Why hello, Leandro 👋</h1>
        </div>
        <div className="wh-home-separator" />
        <section className="wh-activity-section">
          <div className="wh-section-heading">
            <div>
              <h2>Your latest moves</h2>
              <p>The work you’ve put into motion.</p>
            </div>
          </div>
          <div className="wh-activity-list">
            {activity.map(({ icon: Icon, tone, title, detail, time }) => (
              <div className="wh-activity-row" key={`${title}-${detail}`}>
                <span className={`wh-activity-icon is-${tone}`}><Icon size={15} /></span>
                <div className="wh-activity-copy">
                  <strong>{title}</strong>
                  <span>{detail}</span>
                </div>
                <time>{time}</time>
              </div>
            ))}
          </div>
        </section>
        <div className="wh-list-card">
          <div className="wh-list-head">
            <div><h2>Top Leads for Leandro</h2></div>
          </div>
          <div className="wh-table-head"><span>Name</span><span>Score</span><span>Email</span><span>Title</span><span>Company</span><span>Location</span></div>
          {leads.map(({ name, score, email, title, company, location }) => {
            const tier = scoreMeta(score);
            return (
            <div className="wh-person-row" key={name}>
              <div className="wh-person"><span className="wh-avatar">{name.split(" ").map((n) => n[0]).join("")}</span><strong>{name}</strong></div>
              <span className={`wh-score wh-score-${tier.className}`}><b>{score}</b><small>{tier.label}</small></span>
              <span className={`wh-email ${email === "Access Email" ? "is-access" : ""}`}>{email}</span>
              <span className="wh-title">{title}</span>
              <span className="wh-company"><Building2 size={14} /> {company}</span>
              <span className="wh-location">{location}</span>
            </div>
            );
          })}
        </div>
      </section>
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
          <button className="wh-brand-button" aria-label="Whyhello home"><LogoMark /></button>
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
          <button className="wh-route wh-user-route" title={!expanded ? "Abu Batasi" : undefined} aria-label="Open Abu Batasi's profile">
            <i className="wh-user-avatar">AB</i>
            <span>Abu Batasi</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export function SidebarNavigation() {
  return (
    <div className="whyhello-nav-demo min-h-screen">
      <MasterSidebar />
      <HomePage />
    </div>
  );
}