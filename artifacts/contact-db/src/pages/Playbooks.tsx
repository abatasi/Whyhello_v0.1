import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ReactFlow, Background, BackgroundVariant, MiniMap,
  addEdge, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
  Handle, Position, useReactFlow, ReactFlowProvider,
  MarkerType, BaseEdge, getBezierPath, EdgeLabelRenderer,
  useNodesState, useEdgesState, type NodeProps, type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import {
  Plus, ArrowLeft, Trash2, X, Search, Loader2,
  Mail, Phone, Linkedin, Clock, GitBranch, CalendarCheck,
  MessageSquare, LogOut, CheckCircle, Play, UserPlus, Zap,
  MoreHorizontal, Wand2, ChevronDown, ChevronRight,
  Minus, Maximize2, Map, Undo2, Redo2, Save, Upload,
  AlertCircle, Check, GripVertical, SlidersHorizontal,
  FlaskConical, LayoutGrid, Pencil, Copy, BookOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlaybookMeta {
  id: number;
  name: string;
  description: string | null;
  status: string;
  stepCount: number;
  enrollmentCount: number;
  dueCount: number;
  createdAt: string;
  updatedAt: string;
}

interface PlaybookNodeData extends Record<string, unknown> {
  blockType: string;
  label?: string;
  // email
  emailType?: string;
  insightCategory?: string;
  messagingObjective?: string;
  subject?: string;
  emailBody?: string;
  callToAction?: string;
  sendTiming?: string;
  // linkedin
  linkedinAction?: string;
  characterCount?: number;
  linkedinBody?: string;
  // call
  callObjective?: string;
  opener?: string;
  discoveryQuestion?: string;
  voicemail?: string;
  // delay
  delayAmount?: number;
  delayUnit?: string;
  isBusinessDays?: boolean;
  allowedDays?: string[];
  prospectTimezone?: boolean;
  // split
  condition?: string;
  branches?: string[];
  // outcome
  outcomeName?: string;
  stopFutureTouches?: boolean;
  updateStatus?: string;
  createFollowUp?: boolean;
  moveToPlaybook?: string;
}

interface CanvasState {
  nodes: Node<PlaybookNodeData>[];
  edges: Edge[];
}

// ── Block catalogue ───────────────────────────────────────────────────────────

const CATEGORIES: Record<string, {
  label: string; bg: string; border: string; text: string;
  headerBg: string; iconBg: string; iconText: string; handle: string; mini: string;
}> = {
  "starting-point": {
    label: "Starting Points", bg: "bg-violet-50", border: "border-violet-200",
    text: "text-violet-700", headerBg: "bg-violet-50/80", iconBg: "bg-violet-100",
    iconText: "text-violet-600", handle: "!bg-violet-400", mini: "#a78bfa",
  },
  "touchpoint": {
    label: "Touchpoints", bg: "bg-blue-50", border: "border-blue-200",
    text: "text-blue-700", headerBg: "bg-blue-50/80", iconBg: "bg-blue-100",
    iconText: "text-blue-600", handle: "!bg-blue-400", mini: "#60a5fa",
  },
  "flow-control": {
    label: "Flow Controls", bg: "bg-amber-50", border: "border-amber-200",
    text: "text-amber-700", headerBg: "bg-amber-50/80", iconBg: "bg-amber-100",
    iconText: "text-amber-600", handle: "!bg-amber-400", mini: "#fbbf24",
  },
  "outcome": {
    label: "Outcomes", bg: "bg-green-50", border: "border-green-200",
    text: "text-green-700", headerBg: "bg-green-50/80", iconBg: "bg-green-100",
    iconText: "text-green-600", handle: "!bg-green-400", mini: "#4ade80",
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconType = React.ComponentType<any>;

interface BlockDef {
  id: string;
  category: string;
  label: string;
  description: string;
  Icon: IconType;
  defaultData?: Partial<PlaybookNodeData>;
}

const BLOCKS: BlockDef[] = [
  {
    id: "prospect-added", category: "starting-point", label: "Prospect Added",
    description: "Begins when a prospect is manually added or enrolled from a list.",
    Icon: UserPlus,
  },
  {
    id: "trigger-detected", category: "starting-point", label: "Trigger Detected",
    description: "Begins when Whyhello identifies a relevant personal, company, role or industry event.",
    Icon: Zap,
  },
  {
    id: "added-to-playbook", category: "starting-point", label: "Added to Playbook",
    description: "A simple universal starting point for manually or automatically enrolled prospects.",
    Icon: Play,
  },
  {
    id: "send-email", category: "touchpoint", label: "Send Email",
    description: "Creates an email step using a selected Whyhello insight and messaging objective.",
    Icon: Mail,
    defaultData: { emailType: "Initial Email", insightCategory: "Automatic", messagingObjective: "Interrupt" },
  },
  {
    id: "send-linkedin", category: "touchpoint", label: "Send LinkedIn Message",
    description: "Creates a LinkedIn connection request, direct message or follow-up.",
    Icon: Linkedin,
    defaultData: { linkedinAction: "Send Connection Request", insightCategory: "Automatic" },
  },
  {
    id: "make-call", category: "touchpoint", label: "Make Call",
    description: "Creates a call task with a generated opener, voicemail and talking points.",
    Icon: Phone,
    defaultData: { insightCategory: "Automatic" },
  },
  {
    id: "time-delay", category: "flow-control", label: "Time Delay",
    description: "Waits for a defined period before proceeding.",
    Icon: Clock,
    defaultData: { delayAmount: 2, delayUnit: "business days", isBusinessDays: true, prospectTimezone: false },
  },
  {
    id: "split-path", category: "flow-control", label: "Split Path",
    description: "Creates two or more branches based on prospect behaviour or data.",
    Icon: GitBranch,
    defaultData: { condition: "", branches: ["YES", "NO"] },
  },
  {
    id: "meeting-booked", category: "outcome", label: "Meeting Booked",
    description: "Marks the objective as achieved and removes the prospect from further outreach.",
    Icon: CalendarCheck,
    defaultData: { stopFutureTouches: true },
  },
  {
    id: "reply-received", category: "outcome", label: "Reply Received",
    description: "Routes prospects who respond through email or LinkedIn.",
    Icon: MessageSquare,
  },
  {
    id: "exit-playbook", category: "outcome", label: "Exit Playbook",
    description: "Stops all remaining actions for the prospect.",
    Icon: LogOut,
    defaultData: { stopFutureTouches: true },
  },
  {
    id: "sequence-complete", category: "outcome", label: "Sequence Complete",
    description: "Marks the playbook as completed when the prospect reaches the end.",
    Icon: CheckCircle,
    defaultData: { stopFutureTouches: false },
  },
];

const BLOCK_BY_ID = Object.fromEntries(BLOCKS.map(b => [b.id, b]));

// ── Helpers ───────────────────────────────────────────────────────────────────

let _idCounter = 1;
function uid() { return `n_${Date.now()}_${_idCounter++}`; }

function makeNode(blockType: string, position: { x: number; y: number }, extraData?: Partial<PlaybookNodeData>): Node<PlaybookNodeData> {
  const def = BLOCK_BY_ID[blockType];
  return {
    id: uid(),
    type: "playbook",
    position,
    data: { blockType, label: def?.label ?? blockType, ...(def?.defaultData ?? {}), ...extraData },
  };
}

function makeEdge(source: string, target: string, label?: string, sourceHandle?: string): Edge {
  return {
    id: `e_${source}_${target}_${Date.now()}`,
    source,
    target,
    ...(sourceHandle ? { sourceHandle } : {}),
    type: "playbook",
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#94a3b8" },
    style: { stroke: "#94a3b8", strokeWidth: 1.5 },
    label,
    labelStyle: { fontSize: 10, fontWeight: 600, fill: "#64748b" },
    labelBgStyle: { fill: "#f1f5f9", fillOpacity: 0.9 },
  };
}

function delayLabel(d: PlaybookNodeData): string {
  if (!d.delayAmount) return "Time Delay";
  return `Wait ${d.delayAmount} ${d.delayUnit ?? "days"}`;
}

function nodeComplete(data: PlaybookNodeData): boolean {
  switch (data.blockType) {
    case "send-email": return !!(data.subject || data.emailType);
    case "send-linkedin": return !!(data.linkedinAction);
    case "make-call": return true;
    case "time-delay": return !!(data.delayAmount);
    case "split-path": return !!(data.condition) && (data.branches?.length ?? 0) >= 2;
    default: return true;
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Default example canvas ────────────────────────────────────────────────────

function buildDefaultCanvas(): CanvasState {
  const n1 = makeNode("prospect-added", { x: 360, y: 20 });
  const n2 = makeNode("send-email", { x: 360, y: 160 }, { emailType: "Initial Email", subject: "Quick thought on your team" });
  const n3 = makeNode("time-delay", { x: 360, y: 300 }, { delayAmount: 2, delayUnit: "business days", isBusinessDays: true });
  const n4 = makeNode("split-path", { x: 360, y: 440 }, { condition: "Email replied to", branches: ["YES — Replied", "NO — No reply"] });
  const n5 = makeNode("reply-received", { x: 100, y: 620 });
  const n6 = makeNode("exit-playbook", { x: 100, y: 760 });
  const n7 = makeNode("make-call", { x: 620, y: 620 });
  const n8 = makeNode("time-delay", { x: 620, y: 760 }, { delayAmount: 3, delayUnit: "business days", isBusinessDays: true });
  const n9 = makeNode("send-linkedin", { x: 620, y: 900 }, { linkedinAction: "Send Message" });
  const n10 = makeNode("sequence-complete", { x: 620, y: 1040 });

  const nodes = [n1, n2, n3, n4, n5, n6, n7, n8, n9, n10];
  const edges = [
    makeEdge(n1.id, n2.id),
    makeEdge(n2.id, n3.id),
    makeEdge(n3.id, n4.id),
    makeEdge(n4.id, n5.id, "YES — Replied", `${n4.id}-0`),
    makeEdge(n5.id, n6.id),
    makeEdge(n4.id, n7.id, "NO — No reply", `${n4.id}-1`),
    makeEdge(n7.id, n8.id),
    makeEdge(n8.id, n9.id),
    makeEdge(n9.id, n10.id),
  ];
  return { nodes, edges };
}

// ── Canned playbook library ───────────────────────────────────────────────────

interface CannedPlaybook {
  id: string;
  name: string;
  description: string;
  touchpoints: number;
  duration: string;
  intensity: "Light" | "Balanced" | "Persistent";
  build: () => CanvasState;
}

function buildStandard(): CanvasState {
  const n1 = makeNode("prospect-added", { x: 360, y: 20 });
  const n2 = makeNode("send-email", { x: 360, y: 160 }, { emailType: "Initial Email" });
  const n3 = makeNode("time-delay", { x: 360, y: 300 }, { delayAmount: 3, delayUnit: "business days", isBusinessDays: true });
  const n4 = makeNode("send-email", { x: 360, y: 440 }, { emailType: "Follow-up" });
  const n5 = makeNode("time-delay", { x: 360, y: 580 }, { delayAmount: 4, delayUnit: "business days", isBusinessDays: true });
  const n6 = makeNode("make-call", { x: 360, y: 720 });
  const n7 = makeNode("time-delay", { x: 360, y: 860 }, { delayAmount: 5, delayUnit: "business days", isBusinessDays: true });
  const n8 = makeNode("send-email", { x: 360, y: 1000 }, { emailType: "Breakup Email" });
  const n9 = makeNode("sequence-complete", { x: 360, y: 1140 });
  const nodes = [n1, n2, n3, n4, n5, n6, n7, n8, n9];
  const edges = [n1, n2, n3, n4, n5, n6, n7, n8].map((n, i) => makeEdge(n.id, nodes[i + 1].id));
  return { nodes, edges };
}

function buildEmailOnly(): CanvasState {
  const n1 = makeNode("prospect-added", { x: 360, y: 20 });
  const steps = [
    makeNode("send-email", { x: 360, y: 160 }, { emailType: "Initial Email" }),
    makeNode("time-delay", { x: 360, y: 300 }, { delayAmount: 3, delayUnit: "business days", isBusinessDays: true }),
    makeNode("send-email", { x: 360, y: 440 }, { emailType: "Follow-up" }),
    makeNode("time-delay", { x: 360, y: 580 }, { delayAmount: 5, delayUnit: "business days", isBusinessDays: true }),
    makeNode("send-email", { x: 360, y: 720 }, { emailType: "Value Share" }),
    makeNode("time-delay", { x: 360, y: 860 }, { delayAmount: 7, delayUnit: "business days", isBusinessDays: true }),
    makeNode("send-email", { x: 360, y: 1000 }, { emailType: "Breakup Email" }),
    makeNode("sequence-complete", { x: 360, y: 1140 }),
  ];
  const nodes = [n1, ...steps];
  const edges = [n1, ...steps.slice(0, -1)].map((n, i) => makeEdge(n.id, nodes[i + 1].id));
  return { nodes, edges };
}

function buildPhoneForward(): CanvasState {
  const n1 = makeNode("prospect-added", { x: 360, y: 20 });
  const n2 = makeNode("make-call", { x: 360, y: 160 });
  const n3 = makeNode("time-delay", { x: 360, y: 300 }, { delayAmount: 1, delayUnit: "business days", isBusinessDays: true });
  const n4 = makeNode("send-email", { x: 360, y: 440 }, { emailType: "Initial Email" });
  const n5 = makeNode("time-delay", { x: 360, y: 580 }, { delayAmount: 2, delayUnit: "business days", isBusinessDays: true });
  const n6 = makeNode("make-call", { x: 360, y: 720 });
  const n7 = makeNode("time-delay", { x: 360, y: 860 }, { delayAmount: 3, delayUnit: "business days", isBusinessDays: true });
  const n8 = makeNode("send-email", { x: 360, y: 1000 }, { emailType: "Breakup Email" });
  const n9 = makeNode("sequence-complete", { x: 360, y: 1140 });
  const nodes = [n1, n2, n3, n4, n5, n6, n7, n8, n9];
  const edges = [n1, n2, n3, n4, n5, n6, n7, n8].map((n, i) => makeEdge(n.id, nodes[i + 1].id));
  return { nodes, edges };
}

const CANNED_PLAYBOOKS: CannedPlaybook[] = [
  { id: "standard", name: "Standard", description: "A balanced mix of emails and a call over three weeks. The go-to starting point.", touchpoints: 4, duration: "~3 weeks", intensity: "Balanced", build: buildStandard },
  { id: "email-only", name: "Email-Only", description: "Four emails across a month. Ideal for high-volume prospecting.", touchpoints: 4, duration: "~4 weeks", intensity: "Light", build: buildEmailOnly },
  { id: "phone-forward", name: "Phone-Forward", description: "Opens and closes with calls, supported by email. For reps who love the phone.", touchpoints: 5, duration: "~2.5 weeks", intensity: "Persistent", build: buildPhoneForward },
  {
    id: "quick-burst", name: "Quick Burst", description: "High intensity over 5 business days. For time-sensitive opportunities.", touchpoints: 4, duration: "5 days", intensity: "Persistent",
    build: () => {
      const n1 = makeNode("prospect-added", { x: 360, y: 20 });
      const n2 = makeNode("send-email", { x: 360, y: 160 }, { emailType: "Initial Email" });
      const n3 = makeNode("time-delay", { x: 360, y: 300 }, { delayAmount: 1, delayUnit: "business days", isBusinessDays: true });
      const n4 = makeNode("make-call", { x: 360, y: 440 });
      const n5 = makeNode("time-delay", { x: 360, y: 580 }, { delayAmount: 1, delayUnit: "business days", isBusinessDays: true });
      const n6 = makeNode("send-linkedin", { x: 360, y: 720 }, { linkedinAction: "Send Connection Request" });
      const n7 = makeNode("time-delay", { x: 360, y: 860 }, { delayAmount: 1, delayUnit: "business days", isBusinessDays: true });
      const n8 = makeNode("send-email", { x: 360, y: 1000 }, { emailType: "Breakup Email" });
      const n9 = makeNode("sequence-complete", { x: 360, y: 1140 });
      const nodes = [n1, n2, n3, n4, n5, n6, n7, n8, n9];
      const edges = [n1, n2, n3, n4, n5, n6, n7, n8].map((n, i) => makeEdge(n.id, nodes[i + 1].id));
      return { nodes, edges };
    },
  },
  {
    id: "social-first", name: "Social-First", description: "Leads with LinkedIn, then supports with email. Great for active LinkedIn users.", touchpoints: 4, duration: "~3 weeks", intensity: "Balanced",
    build: () => {
      const n1 = makeNode("prospect-added", { x: 360, y: 20 });
      const n2 = makeNode("send-linkedin", { x: 360, y: 160 }, { linkedinAction: "Send Connection Request" });
      const n3 = makeNode("time-delay", { x: 360, y: 300 }, { delayAmount: 2, delayUnit: "business days", isBusinessDays: true });
      const n4 = makeNode("send-linkedin", { x: 360, y: 440 }, { linkedinAction: "Send Message" });
      const n5 = makeNode("time-delay", { x: 360, y: 580 }, { delayAmount: 3, delayUnit: "business days", isBusinessDays: true });
      const n6 = makeNode("send-email", { x: 360, y: 720 }, { emailType: "Initial Email" });
      const n7 = makeNode("time-delay", { x: 360, y: 860 }, { delayAmount: 5, delayUnit: "business days", isBusinessDays: true });
      const n8 = makeNode("send-email", { x: 360, y: 1000 }, { emailType: "Breakup Email" });
      const n9 = makeNode("sequence-complete", { x: 360, y: 1140 });
      const nodes = [n1, n2, n3, n4, n5, n6, n7, n8, n9];
      const edges = [n1, n2, n3, n4, n5, n6, n7, n8].map((n, i) => makeEdge(n.id, nodes[i + 1].id));
      return { nodes, edges };
    },
  },
  {
    id: "slow-burn", name: "Slow Burn", description: "Extended outreach over eight weeks. Best for long sales cycles.", touchpoints: 5, duration: "~8 weeks", intensity: "Light",
    build: () => {
      const n1 = makeNode("prospect-added", { x: 360, y: 20 });
      const nodes: Node<PlaybookNodeData>[] = [n1];
      const pairs = [
        { block: "send-email", delay: 10, data: { emailType: "Initial Email" } },
        { block: "make-call", delay: 7 },
        { block: "send-email", delay: 10, data: { emailType: "Value Share" } },
        { block: "send-linkedin", delay: 7, data: { linkedinAction: "Send Message" } },
        { block: "send-email", delay: 14, data: { emailType: "Breakup Email" } },
      ];
      let y = 160;
      for (const p of pairs) {
        nodes.push(makeNode(p.block, { x: 360, y }, p.data as Partial<PlaybookNodeData>));
        y += 140;
        nodes.push(makeNode("time-delay", { x: 360, y }, { delayAmount: p.delay, delayUnit: "business days", isBusinessDays: true }));
        y += 140;
      }
      nodes.push(makeNode("sequence-complete", { x: 360, y }));
      const edges = nodes.slice(0, -1).map((n, i) => makeEdge(n.id, nodes[i + 1].id));
      return { nodes, edges };
    },
  },
  {
    id: "executive-touch", name: "Executive Touch", description: "Three highly personalised touches. Quality over quantity.", touchpoints: 3, duration: "~2 weeks", intensity: "Light",
    build: () => {
      const n1 = makeNode("prospect-added", { x: 360, y: 20 });
      const n2 = makeNode("send-email", { x: 360, y: 160 }, { emailType: "Initial Email", insightCategory: "Personal" });
      const n3 = makeNode("time-delay", { x: 360, y: 300 }, { delayAmount: 5, delayUnit: "business days", isBusinessDays: true });
      const n4 = makeNode("make-call", { x: 360, y: 440 });
      const n5 = makeNode("time-delay", { x: 360, y: 580 }, { delayAmount: 5, delayUnit: "business days", isBusinessDays: true });
      const n6 = makeNode("send-email", { x: 360, y: 720 }, { emailType: "Breakup Email", insightCategory: "Company" });
      const n7 = makeNode("sequence-complete", { x: 360, y: 860 });
      const nodes = [n1, n2, n3, n4, n5, n6, n7];
      const edges = nodes.slice(0, -1).map((n, i) => makeEdge(n.id, nodes[i + 1].id));
      return { nodes, edges };
    },
  },
  {
    id: "nurture", name: "Nurture", description: "Long-term value sharing with no hard ask. Keeps you top of mind.", touchpoints: 4, duration: "~10 weeks", intensity: "Light",
    build: () => {
      const n1 = makeNode("prospect-added", { x: 360, y: 20 });
      const n2 = makeNode("send-email", { x: 360, y: 160 }, { emailType: "Initial Email", messagingObjective: "Educate" });
      const n3 = makeNode("time-delay", { x: 360, y: 300 }, { delayAmount: 14, delayUnit: "calendar days" });
      const n4 = makeNode("send-email", { x: 360, y: 440 }, { emailType: "Value Share", messagingObjective: "Educate" });
      const n5 = makeNode("time-delay", { x: 360, y: 580 }, { delayAmount: 14, delayUnit: "calendar days" });
      const n6 = makeNode("send-linkedin", { x: 360, y: 720 }, { linkedinAction: "Send Message" });
      const n7 = makeNode("time-delay", { x: 360, y: 860 }, { delayAmount: 21, delayUnit: "calendar days" });
      const n8 = makeNode("send-email", { x: 360, y: 1000 }, { emailType: "Value Share", messagingObjective: "Offer" });
      const n9 = makeNode("sequence-complete", { x: 360, y: 1140 });
      const nodes = [n1, n2, n3, n4, n5, n6, n7, n8, n9];
      const edges = nodes.slice(0, -1).map((n, i) => makeEdge(n.id, nodes[i + 1].id));
      return { nodes, edges };
    },
  },
  {
    id: "strategic-account", name: "Strategic Account", description: "Multi-channel with split paths for different response types. Built for complex deals.", touchpoints: 6, duration: "~5 weeks", intensity: "Balanced",
    build: () => buildDefaultCanvas(),
  },
  {
    id: "compressed", name: "Compressed Campaign", description: "Full sequence in under two weeks. For pipeline that needs to move fast.", touchpoints: 5, duration: "~10 days", intensity: "Persistent",
    build: () => {
      const n1 = makeNode("prospect-added", { x: 360, y: 20 });
      const pairs = [
        { block: "send-email", delay: 2, data: { emailType: "Initial Email" } },
        { block: "make-call", delay: 1 },
        { block: "send-linkedin", delay: 1, data: { linkedinAction: "Send Connection Request" } },
        { block: "send-email", delay: 2, data: { emailType: "Follow-up" } },
        { block: "make-call", delay: 2 },
        { block: "send-email", delay: 2, data: { emailType: "Breakup Email" } },
      ];
      const nodes: Node<PlaybookNodeData>[] = [n1];
      let y = 160;
      for (const p of pairs) {
        nodes.push(makeNode(p.block, { x: 360, y }, p.data as Partial<PlaybookNodeData>));
        y += 140;
        if (p.delay > 0) {
          nodes.push(makeNode("time-delay", { x: 360, y }, { delayAmount: p.delay, delayUnit: "business days", isBusinessDays: true }));
          y += 140;
        }
      }
      nodes.push(makeNode("sequence-complete", { x: 360, y }));
      const edges = nodes.slice(0, -1).map((n, i) => makeEdge(n.id, nodes[i + 1].id));
      return { nodes, edges };
    },
  },
];

// ── Custom Node ───────────────────────────────────────────────────────────────

function PlaybookNodeComponent({ data, selected, id }: NodeProps) {
  const nodeData = data as PlaybookNodeData;
  const def = BLOCK_BY_ID[nodeData.blockType];
  if (!def) return null;
  const cat = CATEGORIES[def.category];
  const Icon = def.Icon as React.ComponentType<{ className?: string }>;
  const complete = nodeComplete(nodeData);
  const isSplit = nodeData.blockType === "split-path";
  const branches = nodeData.branches ?? ["YES", "NO"];

  let summary = "";
  switch (nodeData.blockType) {
    case "send-email":
      summary = [nodeData.emailType, nodeData.messagingObjective, nodeData.subject].filter(Boolean).join(" · ").substring(0, 48) || "Configure email";
      break;
    case "send-linkedin":
      summary = nodeData.linkedinAction || "Configure LinkedIn action";
      break;
    case "make-call":
      summary = nodeData.callObjective || "Configure call objective";
      break;
    case "time-delay":
      summary = delayLabel(nodeData);
      break;
    case "split-path":
      summary = nodeData.condition ? `If: ${nodeData.condition}` : "Set condition";
      break;
    case "meeting-booked": summary = "Prospect converts — remove from outreach"; break;
    case "reply-received": summary = "Route prospects who respond"; break;
    case "exit-playbook": summary = "Stop all future touches"; break;
    case "sequence-complete": summary = "Playbook finished"; break;
    default: summary = def.description.substring(0, 50);
  }

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-white shadow-sm transition-all select-none",
        "min-w-[220px] max-w-[260px]",
        selected ? cn("shadow-lg ring-2 ring-primary/40", cat.border) : cn("hover:shadow-md", cat.border),
        !complete && "ring-1 ring-red-300",
      )}
      style={{ minWidth: 220 }}
    >
      {/* Top handle */}
      {def.category !== "starting-point" && (
        <Handle
          type="target"
          position={Position.Top}
          className={cn("!w-3 !h-3 !border-2 !border-white !rounded-full transition-opacity", cat.handle)}
          style={{ top: -6 }}
        />
      )}

      {/* Card header */}
      <div className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-t-xl border-b", cat.bg, cat.border)}>
        <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0", cat.iconBg)}>
          <Icon className={cn("h-3.5 w-3.5", cat.iconText)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-[11px] font-bold truncate", cat.text)}>{nodeData.label ?? def.label}</p>
        </div>
        {!complete && <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />}
      </div>

      {/* Card body */}
      <div className="px-3 py-2.5">
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{summary}</p>
      </div>

      {/* Split branches */}
      {isSplit && (
        <div className="px-3 pb-2.5 flex flex-col gap-1 relative">
          {branches.map((branch, i) => (
            <div key={i} className="relative">
              <div className={cn("text-[10px] font-semibold rounded-full px-2 py-0.5 border text-center", cat.bg, cat.border, cat.text)}>
                {branch}
              </div>
              <Handle
                type="source"
                position={Position.Bottom}
                id={`${id}-${i}`}
                style={{
                  bottom: -6,
                  left: `${(i + 1) * (100 / (branches.length + 1))}%`,
                }}
                className={cn("!w-3 !h-3 !border-2 !border-white !rounded-full", cat.handle)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Bottom handle */}
      {!isSplit && !["exit-playbook", "sequence-complete"].includes(nodeData.blockType) && (
        <Handle
          type="source"
          position={Position.Bottom}
          className={cn("!w-3 !h-3 !border-2 !border-white !rounded-full", cat.handle)}
          style={{ bottom: -6 }}
        />
      )}
    </div>
  );
}

// ── Custom Edge with + insert button ─────────────────────────────────────────

function PlaybookEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, label,
  markerEnd, style,
  data,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  const onInsert = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (data && typeof data.onInsert === "function") {
      (data.onInsert as (edgeId: string) => void)(id);
    }
  }, [data, id]);

  return (
    <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Wider invisible hit area */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={16} />
      <BaseEdge path={edgePath} markerEnd={markerEnd as string} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: "none" }}
            className="absolute text-[10px] font-semibold text-slate-500 bg-slate-50/90 border border-slate-200 rounded px-1.5 py-0.5 nodrag nopan"
          >
            {String(label)}
          </div>
        </EdgeLabelRenderer>
      )}
      {hovered && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${midX}px,${midY}px)`, pointerEvents: "all" }}
            className="absolute nodrag nopan"
          >
            <button
              onClick={onInsert}
              className="h-5 w-5 rounded-full bg-white border border-border shadow-md flex items-center justify-center hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
}

// ── Configuration Drawer ──────────────────────────────────────────────────────

const EMAIL_TYPES = ["Initial Email", "Follow-up", "Value Share", "Breakup Email"];
const INSIGHT_CATEGORIES = ["Automatic", "Personal", "Company", "Industry", "Role", "Colleague", "Counterpart"];
const MESSAGING_OBJECTIVES = ["Interrupt", "Engage", "Educate", "Offer"];
const LINKEDIN_ACTIONS = ["View Profile", "Send Connection Request", "Send Message", "Send Follow-up"];
const DELAY_UNITS = ["minutes", "hours", "business days", "calendar days"];
const SPLIT_CONDITIONS = [
  "Email opened", "Link clicked", "Email replied to", "LinkedIn reply received",
  "Call connected", "Meeting booked", "No engagement", "Insight available",
  "Contact data available", "Prospect field matches", "Custom condition",
];
const CONTACT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div>
        <p className="text-xs font-semibold text-foreground">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function SelectField({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 pr-8"
      >
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
    </div>
  );
}

function TextInput({ value, onChange, placeholder, multiline }: { value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 resize-none"
      />
    );
  }
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
    />
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-9 h-5 rounded-full transition-colors flex-shrink-0",
          checked ? "bg-primary" : "bg-border/80",
        )}
      >
        <div className={cn("absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", checked && "translate-x-4")} />
      </div>
      <span className="text-xs text-foreground">{label}</span>
    </label>
  );
}

function ConfigDrawer({
  node,
  onClose,
  onUpdate,
  onDelete,
  onDuplicate,
}: {
  node: Node<PlaybookNodeData> | null;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<PlaybookNodeData>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const data = node?.data as PlaybookNodeData | undefined;
  const def = data ? BLOCK_BY_ID[data.blockType] : null;

  if (!node || !data || !def) return null;
  const cat = CATEGORIES[def.category];

  function upd(patch: Partial<PlaybookNodeData>) { onUpdate(node.id, patch); }

  async function handleGenerate() {
    if (!["send-email", "send-linkedin", "make-call"].includes(data.blockType)) return;
    setGenerating(true);
    await new Promise(r => setTimeout(r, 1200));
    if (data.blockType === "send-email") {
      upd({ subject: `Re: Your ${data.insightCategory?.toLowerCase() ?? "company"} news`, emailBody: `Hi {{first_name}},\n\nI noticed your recent activity and wanted to reach out with a perspective that might be relevant.\n\n[Generated content will appear here based on Whyhello insights]\n\n{{cta}}\n\n[Your Name]` });
    } else if (data.blockType === "send-linkedin") {
      upd({ linkedinBody: `Hi {{first_name}}, I came across your profile and [generated insight-driven connection note] would love to connect.` });
    } else if (data.blockType === "make-call") {
      upd({ opener: `Hi {{first_name}}, this is [Name] from [Company]. I noticed [insight] and thought it was worth a quick call.`, voicemail: `Hi {{first_name}}, [Name] from [Company]. I'll keep this brief — [value prop]. I'll follow up by email but feel free to reach back on [number]. Thanks!` });
    }
    toast({ title: "Generated", description: "Content drafted from Whyhello insights" });
    setGenerating(false);
  }

  const Icon = def.Icon as React.ComponentType<{ className?: string }>;

  return (
    <div className="flex flex-col h-full">
      {/* Drawer header */}
      <div className={cn("flex items-center gap-3 px-4 py-3 border-b border-border/60 flex-shrink-0", cat.headerBg)}>
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 border", cat.iconBg, cat.border)}>
          <Icon className={cn("h-4 w-4", cat.iconText)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-xs font-bold", cat.text)}>{def.label}</p>
          <p className="text-[10px] text-muted-foreground truncate">{def.category.replace("-", " ")}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onDuplicate(node.id)} className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors" title="Duplicate">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { onDelete(node.id); onClose(); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Drawer body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">

        {/* Step name */}
        <Field label="Step name">
          <TextInput value={data.label ?? def.label} onChange={v => upd({ label: v })} placeholder="Step name" />
        </Field>

        <div className="h-px bg-border/40" />

        {/* ── Send Email ── */}
        {data.blockType === "send-email" && (<>
          <Field label="Email type">
            <SelectField value={data.emailType ?? "Initial Email"} onChange={v => upd({ emailType: v })} options={EMAIL_TYPES} />
          </Field>
          <Field label="Outside-in insight category" hint="Which insight type should drive this message?">
            <SelectField value={data.insightCategory ?? "Automatic"} onChange={v => upd({ insightCategory: v })} options={INSIGHT_CATEGORIES} />
          </Field>
          <Field label="Messaging objective">
            <SelectField value={data.messagingObjective ?? "Interrupt"} onChange={v => upd({ messagingObjective: v })} options={MESSAGING_OBJECTIVES} />
          </Field>
          <Field label="Subject line">
            <TextInput value={data.subject ?? ""} onChange={v => upd({ subject: v })} placeholder="Subject line…" />
          </Field>
          <Field label="Message preview">
            <TextInput value={data.emailBody ?? ""} onChange={v => upd({ emailBody: v })} placeholder="Message body…" multiline />
          </Field>
          <Field label="Call to action">
            <TextInput value={data.callToAction ?? ""} onChange={v => upd({ callToAction: v })} placeholder="e.g. Open to a 15-min call?" />
          </Field>
          <Field label="Send timing">
            <TextInput value={data.sendTiming ?? ""} onChange={v => upd({ sendTiming: v })} placeholder="e.g. Tuesday 9–11 AM" />
          </Field>
          <button onClick={handleGenerate} disabled={generating} className={cn("flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all", cat.border, cat.text, cat.bg, "hover:opacity-80 disabled:opacity-50")}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Generate with Whyhello
          </button>
        </>)}

        {/* ── Send LinkedIn ── */}
        {data.blockType === "send-linkedin" && (<>
          <Field label="LinkedIn action">
            <SelectField value={data.linkedinAction ?? "Send Connection Request"} onChange={v => upd({ linkedinAction: v })} options={LINKEDIN_ACTIONS} />
          </Field>
          <Field label="Outside-in insight category">
            <SelectField value={data.insightCategory ?? "Automatic"} onChange={v => upd({ insightCategory: v })} options={INSIGHT_CATEGORIES} />
          </Field>
          <Field label="Messaging objective">
            <SelectField value={data.messagingObjective ?? "Engage"} onChange={v => upd({ messagingObjective: v })} options={MESSAGING_OBJECTIVES} />
          </Field>
          <Field label="Message" hint={`${(data.linkedinBody ?? "").length}/300 characters`}>
            <TextInput value={data.linkedinBody ?? ""} onChange={v => upd({ linkedinBody: v })} placeholder="LinkedIn message…" multiline />
          </Field>
          <button onClick={handleGenerate} disabled={generating} className={cn("flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all", cat.border, cat.text, cat.bg, "hover:opacity-80 disabled:opacity-50")}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Generate with Whyhello
          </button>
        </>)}

        {/* ── Make Call ── */}
        {data.blockType === "make-call" && (<>
          <Field label="Call objective">
            <TextInput value={data.callObjective ?? ""} onChange={v => upd({ callObjective: v })} placeholder="e.g. Book a discovery call" />
          </Field>
          <Field label="Outside-in insight category">
            <SelectField value={data.insightCategory ?? "Automatic"} onChange={v => upd({ insightCategory: v })} options={INSIGHT_CATEGORIES} />
          </Field>
          <Field label="Call opener">
            <TextInput value={data.opener ?? ""} onChange={v => upd({ opener: v })} placeholder="Opening line for the call…" multiline />
          </Field>
          <Field label="Discovery question">
            <TextInput value={data.discoveryQuestion ?? ""} onChange={v => upd({ discoveryQuestion: v })} placeholder="e.g. What's driving that priority right now?" />
          </Field>
          <Field label="Voicemail script">
            <TextInput value={data.voicemail ?? ""} onChange={v => upd({ voicemail: v })} placeholder="Short voicemail if no answer…" multiline />
          </Field>
          <button onClick={handleGenerate} disabled={generating} className={cn("flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all", cat.border, cat.text, cat.bg, "hover:opacity-80 disabled:opacity-50")}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Generate with Whyhello
          </button>
        </>)}

        {/* ── Time Delay ── */}
        {data.blockType === "time-delay" && (<>
          <Field label="Delay">
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                value={data.delayAmount ?? 1}
                onChange={e => upd({ delayAmount: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-24 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex-1">
                <SelectField value={data.delayUnit ?? "business days"} onChange={v => upd({ delayUnit: v, isBusinessDays: v === "business days" })} options={DELAY_UNITS} />
              </div>
            </div>
          </Field>
          <Field label="Preview">
            <div className={cn("px-3 py-2 rounded-lg border text-sm", cat.bg, cat.border, cat.text)}>
              {delayLabel(data)}
            </div>
          </Field>
          <Toggle checked={data.prospectTimezone ?? false} onChange={v => upd({ prospectTimezone: v })} label="Use prospect's timezone" />
          {(data.isBusinessDays || data.delayUnit === "business days") && (
            <Field label="Contact days">
              <div className="flex gap-1.5 flex-wrap">
                {CONTACT_DAYS.map(d => {
                  const active = (data.allowedDays ?? CONTACT_DAYS).includes(d);
                  return (
                    <button key={d} onClick={() => {
                      const cur = data.allowedDays ?? [...CONTACT_DAYS];
                      upd({ allowedDays: active ? cur.filter(x => x !== d) : [...cur, d] });
                    }} className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border transition-all", active ? cn(cat.bg, cat.border, cat.text) : "bg-card border-border/60 text-muted-foreground")}>
                      {d}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}
        </>)}

        {/* ── Split Path ── */}
        {data.blockType === "split-path" && (<>
          <Field label="Condition" hint="When does this split activate?">
            <SelectField value={data.condition ?? ""} onChange={v => upd({ condition: v })} options={["", ...SPLIT_CONDITIONS]} />
          </Field>
          <Field label="Branches">
            <div className="flex flex-col gap-2">
              {(data.branches ?? ["YES", "NO"]).map((branch, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={branch}
                    onChange={e => {
                      const b = [...(data.branches ?? ["YES", "NO"])];
                      b[i] = e.target.value;
                      upd({ branches: b });
                    }}
                    className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {(data.branches?.length ?? 2) > 2 && (
                    <button onClick={() => { const b = [...(data.branches ?? [])]; b.splice(i, 1); upd({ branches: b }); }} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => upd({ branches: [...(data.branches ?? ["YES", "NO"]), "Branch " + ((data.branches?.length ?? 2) + 1)] })}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 py-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add branch
              </button>
            </div>
          </Field>
        </>)}

        {/* ── Outcomes ── */}
        {def.category === "outcome" && (<>
          <Field label="Outcome name">
            <TextInput value={data.outcomeName ?? def.label} onChange={v => upd({ outcomeName: v })} placeholder="Outcome name" />
          </Field>
          <Toggle checked={data.stopFutureTouches ?? true} onChange={v => upd({ stopFutureTouches: v })} label="Stop future touches" />
          <Toggle checked={data.createFollowUp ?? false} onChange={v => upd({ createFollowUp: v })} label="Create follow-up task" />
          <Field label="Update prospect status">
            <SelectField value={data.updateStatus ?? ""} onChange={v => upd({ updateStatus: v })} options={["", "Working", "Qualified", "Unqualified", "Nurture", "Won", "Lost"]} />
          </Field>
          <Field label="Move to playbook">
            <TextInput value={data.moveToPlaybook ?? ""} onChange={v => upd({ moveToPlaybook: v })} placeholder="Select another playbook…" />
          </Field>
        </>)}

      </div>
    </div>
  );
}

// ── Left panel ────────────────────────────────────────────────────────────────

function BlockPanel({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() =>
    BLOCKS.filter(b => !search || b.label.toLowerCase().includes(search.toLowerCase()) || b.description.toLowerCase().includes(search.toLowerCase())),
    [search]
  );
  const grouped = useMemo(() => {
    const g: Record<string, BlockDef[]> = {};
    for (const b of filtered) { (g[b.category] ??= []).push(b); }
    return g;
  }, [filtered]);

  function onDragStart(e: React.DragEvent, blockId: string) {
    e.dataTransfer.setData("application/playbook-block", blockId);
    e.dataTransfer.effectAllowed = "move";
  }

  if (collapsed) {
    return (
      <div className="w-10 flex flex-col items-center pt-3 border-r border-border/60 bg-card flex-shrink-0">
        <button onClick={onToggle} className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground" title="Expand panel">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 flex flex-col border-r border-border/60 bg-card flex-shrink-0 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border/40 flex-shrink-0">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-bold text-foreground">Building Blocks</p>
        </div>
        <button onClick={onToggle} className="p-1 rounded hover:bg-secondary/40 text-muted-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/30 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search blocks…"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/40"
          />
          {search && <button onClick={() => setSearch("")}><X className="h-3 w-3 text-muted-foreground/50" /></button>}
        </div>
      </div>

      {/* Block list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-3">
        {Object.entries(grouped).map(([catId, blocks]) => {
          const cat = CATEGORIES[catId];
          return (
            <div key={catId}>
              <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-1.5 mt-1", cat.text)}>{cat.label}</p>
              <div className="flex flex-col gap-1">
                {blocks.map(b => {
                  const Icon = b.Icon as React.ComponentType<{ className?: string }>;
                  return (
                    <div
                      key={b.id}
                      draggable
                      onDragStart={e => onDragStart(e, b.id)}
                      className={cn(
                        "flex items-center gap-2.5 p-2.5 rounded-xl border cursor-grab active:cursor-grabbing transition-all select-none",
                        "hover:shadow-sm",
                        cat.bg, cat.border,
                      )}
                    >
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 border", cat.iconBg, cat.border)}>
                        <Icon className={cn("h-3.5 w-3.5", cat.iconText)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-[11px] font-semibold leading-tight", cat.text)}>{b.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-1">{b.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Playbook top bar ──────────────────────────────────────────────────────────

function PlaybookTopbar({
  playbookId, name, status, onNameChange, onBack, onSave, onTest,
  canUndo, canRedo, onUndo, onRedo, saving, onPublish,
}: {
  playbookId: number; name: string; status: string;
  onNameChange: (n: string) => void; onBack: () => void; onSave: () => void;
  onTest: () => void; canUndo: boolean; canRedo: boolean;
  onUndo: () => void; onRedo: () => void; saving: boolean; onPublish: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(name);
  const nameRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => { setNameInput(name); }, [name]);

  function commitName() {
    if (nameInput.trim()) onNameChange(nameInput.trim());
    setEditingName(false);
  }

  return (
    <div className="h-12 flex items-center gap-2 px-3 border-b border-border/60 bg-card flex-shrink-0 z-10">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-secondary/40 flex-shrink-0"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Playbooks
      </button>

      <div className="w-px h-5 bg-border/60 flex-shrink-0" />

      {/* Name */}
      {editingName ? (
        <input
          ref={nameRef}
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onBlur={commitName}
          onKeyDown={e => { if (e.key === "Enter") commitName(); if (e.key === "Escape") setEditingName(false); }}
          autoFocus
          className="text-sm font-semibold bg-transparent border-b border-primary focus:outline-none min-w-[120px] max-w-[300px]"
        />
      ) : (
        <button onClick={() => { setNameInput(name); setEditingName(true); }} className="flex items-center gap-1.5 group hover:bg-secondary/40 rounded-lg px-2 py-1">
          <span className="text-sm font-semibold text-foreground">{name}</span>
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )}

      {/* Status */}
      <span className={cn(
        "text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0",
        status === "active" ? "bg-green-50 text-green-700 border-green-200" :
        status === "draft" ? "bg-secondary text-muted-foreground border-border/60" :
        "bg-amber-50 text-amber-700 border-amber-200"
      )}>
        {status === "draft" ? "Draft" : status === "active" ? "Active" : "Paused"}
      </span>

      <div className="flex-1" />

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5">
        <button onClick={onUndo} disabled={!canUndo} className="p-1.5 rounded-lg hover:bg-secondary/40 text-muted-foreground disabled:opacity-30 transition-colors" title="Undo (Ctrl+Z)">
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={onRedo} disabled={!canRedo} className="p-1.5 rounded-lg hover:bg-secondary/40 text-muted-foreground disabled:opacity-30 transition-colors" title="Redo (Ctrl+Y)">
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="w-px h-5 bg-border/60 flex-shrink-0" />

      {/* Test */}
      <button onClick={onTest} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs font-semibold text-muted-foreground hover:bg-secondary/40 transition-colors">
        <FlaskConical className="h-3.5 w-3.5" />
        Test
      </button>

      {/* Save */}
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs font-semibold text-muted-foreground hover:bg-secondary/40 transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Save
      </button>

      {/* Publish */}
      <button
        onClick={onPublish}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
      >
        <Upload className="h-3.5 w-3.5" />
        Publish
      </button>
    </div>
  );
}

// ── Summary panel ─────────────────────────────────────────────────────────────

function SummaryPanel({ nodes, edges }: { nodes: Node<PlaybookNodeData>[]; edges: Edge[] }) {
  const nodeData = nodes.map(n => n.data as PlaybookNodeData);
  const emails = nodeData.filter(d => d.blockType === "send-email").length;
  const linkedins = nodeData.filter(d => d.blockType === "send-linkedin").length;
  const calls = nodeData.filter(d => d.blockType === "make-call").length;
  const delays = nodeData.filter(d => d.blockType === "time-delay");
  const branches = nodeData.filter(d => d.blockType === "split-path").length;
  const touchpoints = emails + linkedins + calls;
  const totalDays = delays.reduce((acc, d) => {
    const amt = d.delayAmount ?? 0;
    const unit = d.delayUnit ?? "business days";
    if (unit === "minutes") return acc + amt / 1440;
    if (unit === "hours") return acc + amt / 24;
    return acc + amt;
  }, 0);
  const incomplete = nodeData.filter(d => !nodeComplete(d));
  const intensity: "Light" | "Balanced" | "Persistent" = touchpoints <= 3 ? "Light" : touchpoints <= 6 ? "Balanced" : "Persistent";

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-xs font-bold text-foreground">Playbook Summary</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Touchpoints", value: touchpoints },
          { label: "Duration", value: `~${Math.round(totalDays)} days` },
          { label: "Emails", value: emails },
          { label: "LinkedIn", value: linkedins },
          { label: "Calls", value: calls },
          { label: "Branches", value: branches },
        ].map(({ label, value }) => (
          <div key={label} className="bg-secondary/30 rounded-lg px-2.5 py-2 border border-border/40">
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className="text-sm font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>
      <div className={cn("flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-semibold",
        intensity === "Light" ? "bg-green-50 border-green-200 text-green-700" :
        intensity === "Balanced" ? "bg-blue-50 border-blue-200 text-blue-700" :
        "bg-amber-50 border-amber-200 text-amber-700"
      )}>
        <div className="h-2 w-2 rounded-full bg-current" />
        {intensity} intensity
      </div>
      {incomplete.length > 0 && (
        <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{incomplete.length} incomplete block{incomplete.length > 1 ? "s" : ""} need configuration before publishing.</p>
        </div>
      )}
    </div>
  );
}

// ── Test panel ────────────────────────────────────────────────────────────────

function TestPanel({ nodes, onClose }: { nodes: Node<PlaybookNodeData>[]; onClose: () => void }) {
  const [simulatedPath, setSimulatedPath] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  async function runSimulation() {
    setRunning(true);
    setSimulatedPath([]);
    const startNode = nodes.find(n => (n.data as PlaybookNodeData).blockType === "prospect-added" || (n.data as PlaybookNodeData).blockType === "added-to-playbook" || (n.data as PlaybookNodeData).blockType === "trigger-detected");
    if (!startNode) { setRunning(false); return; }
    const path: string[] = [startNode.id];
    await new Promise(r => setTimeout(r, 600));
    setSimulatedPath([...path]);
    for (const n of nodes.slice(0, 5)) {
      if (n.id === startNode.id) continue;
      await new Promise(r => setTimeout(r, 400));
      path.push(n.id);
      setSimulatedPath([...path]);
    }
    setRunning(false);
  }

  return (
    <div className="w-80 border-l border-border/60 bg-card flex flex-col flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-bold">Test Playbook</p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-secondary/40 text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">Simulate how a prospect moves through this playbook to check your logic and identify missing configuration.</p>
        <button
          onClick={runSimulation}
          disabled={running}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Simulating…" : "Run Simulation"}
        </button>
        {simulatedPath.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Simulated path</p>
            {simulatedPath.map((nodeId, i) => {
              const node = nodes.find(n => n.id === nodeId);
              if (!node) return null;
              const d = node.data as PlaybookNodeData;
              const def = BLOCK_BY_ID[d.blockType];
              const cat = def ? CATEGORIES[def.category] : null;
              const Icon = def?.Icon as React.ComponentType<{ className?: string }> | undefined;
              return (
                <div key={nodeId} className={cn("flex items-center gap-2.5 px-2.5 py-2 rounded-lg border", cat?.bg, cat?.border)}>
                  {Icon && <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", cat?.iconText)} />}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-semibold", cat?.text)}>{d.label ?? def?.label}</p>
                    {d.blockType === "time-delay" && <p className="text-[10px] text-muted-foreground">{delayLabel(d)}</p>}
                  </div>
                  <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Canned library modal ──────────────────────────────────────────────────────

function CannedLibraryModal({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (p: CannedPlaybook) => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-[640px] max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-bold">Playbook Templates</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/40 text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 grid grid-cols-2 gap-3">
          {CANNED_PLAYBOOKS.map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p); onClose(); }}
              className="flex flex-col gap-2 p-4 rounded-xl border border-border/60 bg-card hover:bg-secondary/30 hover:shadow-md text-left transition-all group"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{p.name}</p>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0",
                  p.intensity === "Light" ? "bg-green-50 text-green-700 border-green-200" :
                  p.intensity === "Balanced" ? "bg-blue-50 text-blue-700 border-blue-200" :
                  "bg-amber-50 text-amber-700 border-amber-200"
                )}>
                  {p.intensity}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{p.description}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-muted-foreground">{p.touchpoints} touchpoints</span>
                <span className="text-[10px] text-muted-foreground">{p.duration}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyCanvas({ onScratch, onTemplate }: { onScratch: () => void; onTemplate: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 pointer-events-none z-10">
      <div className="flex flex-col items-center gap-3 pointer-events-auto text-center">
        <div className="h-14 w-14 rounded-2xl bg-secondary/60 border border-border/60 flex items-center justify-center">
          <GitBranch className="h-7 w-7 text-muted-foreground/60" />
        </div>
        <div>
          <p className="text-base font-bold text-foreground">Build your playbook</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">Drag a starting point onto the canvas or begin with a proven Whyhello template.</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <button onClick={onScratch} className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-secondary/40 transition-colors">
            Start from Scratch
          </button>
          <button onClick={onTemplate} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
            Choose a Template
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Zoom controls ─────────────────────────────────────────────────────────────

function ZoomControls({ showMinimap, onToggleMinimap }: { showMinimap: boolean; onToggleMinimap: () => void }) {
  const { zoomIn, zoomOut, fitView, getZoom } = useReactFlow();
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      setZoom(Math.round(getZoom() * 100));
    }, 200);
    return () => clearInterval(interval);
  }, [getZoom]);

  return (
    <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-card border border-border/60 rounded-xl shadow-sm p-1 z-10">
      <button onClick={() => zoomOut()} className="p-1.5 rounded-lg hover:bg-secondary/40 text-muted-foreground" title="Zoom out">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="text-[11px] font-semibold text-muted-foreground w-10 text-center">{zoom}%</span>
      <button onClick={() => zoomIn()} className="p-1.5 rounded-lg hover:bg-secondary/40 text-muted-foreground" title="Zoom in">
        <Plus className="h-3.5 w-3.5" />
      </button>
      <div className="w-px h-4 bg-border/60" />
      <button onClick={() => fitView({ padding: 0.15, duration: 400 })} className="p-1.5 rounded-lg hover:bg-secondary/40 text-muted-foreground" title="Fit to screen">
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
      <button onClick={onToggleMinimap} className={cn("p-1.5 rounded-lg text-muted-foreground transition-colors", showMinimap ? "bg-secondary/60" : "hover:bg-secondary/40")} title="Toggle minimap">
        <Map className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Node + edge type maps ─────────────────────────────────────────────────────

const nodeTypes = { playbook: PlaybookNodeComponent };
const edgeTypes = { playbook: PlaybookEdge };

// ── Canvas inner (must be inside ReactFlowProvider) ───────────────────────────

interface HistoryEntry { nodes: Node<PlaybookNodeData>[]; edges: Edge[] }

function CanvasInner({
  playbookId, playbookName, playbookStatus,
  onNameChange, onBack, onSave: externalSave, saving,
}: {
  playbookId: number; playbookName: string; playbookStatus: string;
  onNameChange: (n: string) => void; onBack: () => void;
  onSave: (nodes: Node<PlaybookNodeData>[], edges: Edge[]) => void; saving: boolean;
}) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const { toast } = useToast();

  const storageKey = `playbook_canvas_v2_${playbookId}`;

  // Load initial state — v2 key discards any pre-fix cached data
  const initialState = useMemo<CanvasState>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as CanvasState;
        // Sanitize edges: strip sourceHandle when null so React Flow doesn't warn
        parsed.edges = (parsed.edges ?? []).map(e => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { sourceHandle, ...rest } = e as any;
          return (sourceHandle !== null && sourceHandle !== undefined)
            ? { ...rest, sourceHandle }
            : rest;
        });
        return parsed;
      }
    } catch {}
    return buildDefaultCanvas();
  }, [storageKey]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<PlaybookNodeData>>(initialState.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialState.edges);

  // History for undo/redo
  const historyRef = useRef<HistoryEntry[]>([{ nodes: initialState.nodes, edges: initialState.edges }]);
  const historyIndexRef = useRef(0);

  function pushHistory(n: Node<PlaybookNodeData>[], e: Edge[]) {
    const entry = { nodes: JSON.parse(JSON.stringify(n)), edges: JSON.parse(JSON.stringify(e)) };
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(entry);
    historyIndexRef.current = historyRef.current.length - 1;
  }

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  function updateHistoryState() {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }

  function undo() {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    const prev = historyRef.current[historyIndexRef.current];
    setNodes(prev.nodes);
    setEdges(prev.edges);
    updateHistoryState();
  }

  function redo() {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    const next = historyRef.current[historyIndexRef.current];
    setNodes(next.nodes);
    setEdges(next.edges);
    updateHistoryState();
  }

  function commitToHistory(n: Node<PlaybookNodeData>[], e: Edge[]) {
    pushHistory(n, e);
    updateHistoryState();
  }

  // Selected node for config drawer
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);

  // Panels
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
  const [showCanned, setShowCanned] = useState(false);

  // Insert block menu
  const [insertMenu, setInsertMenu] = useState<{ edgeId: string; x: number; y: number } | null>(null);
  const [insertSearch, setInsertSearch] = useState("");

  const isEmpty = nodes.length === 0;

  // Auto-save to localStorage
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify({ nodes, edges })); } catch {}
  }, [nodes, edges, storageKey]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key === "Escape") { setSelectedNodeId(null); setInsertMenu(null); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Fit on mount
  useEffect(() => {
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100);
  }, [fitView]);

  // DnD
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const blockType = e.dataTransfer.getData("application/playbook-block");
    if (!blockType) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const newNode = makeNode(blockType, position);
    setNodes(prev => {
      const next = [...prev, newNode];
      commitToHistory(next, edges);
      return next;
    });
  }, [screenToFlowPosition, setNodes, edges]);

  // Connect
  const onConnect = useCallback((params: Connection) => {
    const edge = makeEdge(params.source!, params.target!, undefined, params.sourceHandle ?? undefined);
    setEdges(prev => {
      const next = addEdge({ ...edge, type: "playbook" }, prev);
      commitToHistory(nodes, next);
      return next;
    });
  }, [setEdges, nodes]);

  // Node change — commit to history on drag stop
  const onNodesChangeWithHistory = useCallback((changes: NodeChange[]) => {
    const hasDragStop = changes.some(c => c.type === "position" && c.dragging === false);
    onNodesChange(changes);
    if (hasDragStop) {
      setNodes(curr => { commitToHistory(curr, edges); return curr; });
    }
  }, [onNodesChange, setNodes, edges]);

  // Edge change
  const onEdgesChangeWithHistory = useCallback((changes: EdgeChange[]) => {
    const hasRemove = changes.some(c => c.type === "remove");
    onEdgesChange(changes);
    if (hasRemove) {
      setEdges(curr => { commitToHistory(nodes, curr); return curr; });
    }
  }, [onEdgesChange, setEdges, nodes]);

  // Node selection
  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setInsertMenu(null);
  }, []);

  // Update node data
  function updateNode(id: string, patch: Partial<PlaybookNodeData>) {
    setNodes(prev => {
      const next = prev.map(n => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n);
      commitToHistory(next, edges);
      return next;
    });
  }

  // Delete node
  function deleteNode(id: string) {
    setNodes(prev => {
      const next = prev.filter(n => n.id !== id);
      const nextEdges = edges.filter(e => e.source !== id && e.target !== id);
      setEdges(nextEdges);
      commitToHistory(next, nextEdges);
      return next;
    });
  }

  // Duplicate node
  function duplicateNode(id: string) {
    const src = nodes.find(n => n.id === id);
    if (!src) return;
    const newNode = makeNode(src.data.blockType as string, { x: src.position.x + 40, y: src.position.y + 40 }, src.data as Partial<PlaybookNodeData>);
    setNodes(prev => { const next = [...prev, newNode]; commitToHistory(next, edges); return next; });
  }

  // Insert via + button on edge
  function onInsertOnEdge(edgeId: string) {
    const edge = edges.find(e => e.id === edgeId);
    if (!edge) return;
    const srcNode = nodes.find(n => n.id === edge.source);
    const tgtNode = nodes.find(n => n.id === edge.target);
    if (!srcNode || !tgtNode) return;
    const x = (srcNode.position.x + tgtNode.position.x) / 2;
    const y = (srcNode.position.y + tgtNode.position.y) / 2;
    setInsertMenu({ edgeId, x, y });
    setInsertSearch("");
  }

  function insertBlock(blockType: string) {
    if (!insertMenu) return;
    const edge = edges.find(e => e.id === insertMenu.edgeId);
    if (!edge) return;
    const srcNode = nodes.find(n => n.id === edge.source);
    const tgtNode = nodes.find(n => n.id === edge.target);
    if (!srcNode || !tgtNode) return;
    const newNode = makeNode(blockType, {
      x: (srcNode.position.x + tgtNode.position.x) / 2 - 110,
      y: (srcNode.position.y + tgtNode.position.y) / 2,
    });
    const newEdge1 = makeEdge(edge.source, newNode.id, undefined, edge.sourceHandle ?? undefined);
    const newEdge2 = makeEdge(newNode.id, edge.target);
    setNodes(prev => { const next = [...prev, newNode]; return next; });
    setEdges(prev => {
      const next = [...prev.filter(e => e.id !== insertMenu.edgeId), { ...newEdge1, type: "playbook" }, { ...newEdge2, type: "playbook" }];
      commitToHistory([...nodes, newNode], next);
      return next;
    });
    setInsertMenu(null);
  }

  // Canned playbook
  function applyCanned(canned: CannedPlaybook) {
    const state = canned.build();
    setNodes(state.nodes);
    setEdges(state.edges);
    commitToHistory(state.nodes, state.edges);
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100);
  }

  // Save
  function save() {
    externalSave(nodes, edges);
  }

  // Publish
  function publish() {
    toast({ title: "Publishing…", description: "Playbook published and ready to enroll prospects." });
  }

  // Check for adjacent touchpoints (suggestion)
  const touchpointWarning = useMemo(() => {
    for (const edge of edges) {
      const src = nodes.find(n => n.id === edge.source)?.data as PlaybookNodeData | undefined;
      const tgt = nodes.find(n => n.id === edge.target)?.data as PlaybookNodeData | undefined;
      if (!src || !tgt) continue;
      const isTouchpoint = (d: PlaybookNodeData) => ["send-email", "send-linkedin", "make-call"].includes(d.blockType);
      if (isTouchpoint(src) && isTouchpoint(tgt)) return true;
    }
    return false;
  }, [nodes, edges]);

  // Wire edge data.onInsert
  const edgesWithInsert = useMemo(() =>
    edges.map(e => ({ ...e, type: "playbook", data: { ...((e.data as object) ?? {}), onInsert: onInsertOnEdge } })),
    [edges, onInsertOnEdge]
  );

  const filteredInsertBlocks = useMemo(() =>
    BLOCKS.filter(b => !insertSearch || b.label.toLowerCase().includes(insertSearch.toLowerCase())),
    [insertSearch]
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Topbar */}
      <PlaybookTopbar
        playbookId={playbookId}
        name={playbookName}
        status={playbookStatus}
        onNameChange={onNameChange}
        onBack={onBack}
        onSave={save}
        onTest={() => { setShowTest(v => !v); setShowSummary(false); }}
        onPublish={publish}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        saving={saving}
      />

      {/* Suggestion banner */}
      {touchpointWarning && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">Consider adding a time delay between consecutive touchpoints.</p>
          </div>
          <button className="text-amber-600 hover:text-amber-800 text-xs font-semibold">Dismiss</button>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Block panel */}
        <BlockPanel collapsed={panelCollapsed} onToggle={() => setPanelCollapsed(v => !v)} />

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden" onDragOver={onDragOver} onDrop={onDrop}>
          {isEmpty && (
            <EmptyCanvas
              onScratch={() => {
                const n = makeNode("prospect-added", { x: 300, y: 200 });
                setNodes([n]);
                setEdges([]);
                commitToHistory([n], []);
              }}
              onTemplate={() => setShowCanned(true)}
            />
          )}

          <ReactFlow
            nodes={nodes}
            edges={edgesWithInsert}
            onNodesChange={onNodesChangeWithHistory}
            onEdgesChange={onEdgesChangeWithHistory}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            deleteKeyCode="Delete"
            multiSelectionKeyCode="Shift"
            selectionKeyCode="Shift"
            fitView
            fitViewOptions={{ padding: 0.15 }}
            defaultViewport={{ x: 60, y: 40, zoom: 0.9 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            className="bg-[#fafafa]"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
            {showMinimap && (
              <MiniMap
                nodeColor={(node) => {
                  const d = node.data as PlaybookNodeData;
                  const def = BLOCK_BY_ID[d?.blockType];
                  return def ? CATEGORIES[def.category].mini : "#e2e8f0";
                }}
                maskColor="rgba(0,0,0,0.04)"
                className="rounded-xl border border-border/60 shadow-sm !bottom-14 !right-4"
                style={{ width: 160, height: 100 }}
              />
            )}
          </ReactFlow>

          {/* Zoom controls */}
          <ZoomControls showMinimap={showMinimap} onToggleMinimap={() => setShowMinimap(v => !v)} />

          {/* Summary toggle */}
          <button
            onClick={() => { setShowSummary(v => !v); setShowTest(false); }}
            className={cn("absolute bottom-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-sm z-10", showSummary ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/60 text-muted-foreground hover:bg-secondary/40")}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Summary
          </button>

          {/* Insert block menu */}
          {insertMenu && (
            <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="pointer-events-auto bg-card border border-border rounded-xl shadow-2xl w-64 overflow-hidden">
                <div className="px-3 py-2 border-b border-border/40">
                  <p className="text-xs font-bold text-foreground mb-1.5">Insert block</p>
                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/30 px-2 py-1.5">
                    <Search className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                    <input autoFocus value={insertSearch} onChange={e => setInsertSearch(e.target.value)} placeholder="Search…" className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/40" />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {filteredInsertBlocks.map(b => {
                    const cat = CATEGORIES[b.category];
                    const Icon = b.Icon as React.ComponentType<{ className?: string }>;
                    return (
                      <button
                        key={b.id}
                        onClick={() => insertBlock(b.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-secondary/40 text-left transition-colors border-b border-border/30 last:border-0"
                      >
                        <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0 border", cat.iconBg, cat.border)}>
                          <Icon className={cn("h-3 w-3", cat.iconText)} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{b.label}</p>
                          <p className={cn("text-[10px]", cat.text)}>{cat.label}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="px-3 py-2 border-t border-border/40">
                  <button onClick={() => setInsertMenu(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary panel */}
        {showSummary && (
          <div className="w-64 border-l border-border/60 bg-card flex flex-col flex-shrink-0 overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 flex-shrink-0">
              <p className="text-xs font-bold">Summary</p>
              <button onClick={() => setShowSummary(false)} className="p-1 rounded hover:bg-secondary/40 text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
            <SummaryPanel nodes={nodes as Node<PlaybookNodeData>[]} edges={edges} />
          </div>
        )}

        {/* Test panel */}
        {showTest && <TestPanel nodes={nodes as Node<PlaybookNodeData>[]} onClose={() => setShowTest(false)} />}

        {/* Config drawer */}
        {selectedNode && (
          <div className="w-80 border-l border-border/60 bg-card flex flex-col flex-shrink-0 overflow-hidden">
            <ConfigDrawer
              node={selectedNode as Node<PlaybookNodeData>}
              onClose={() => setSelectedNodeId(null)}
              onUpdate={updateNode}
              onDelete={deleteNode}
              onDuplicate={duplicateNode}
            />
          </div>
        )}
      </div>

      <CannedLibraryModal open={showCanned} onClose={() => setShowCanned(false)} onSelect={applyCanned} />
    </div>
  );
}

// ── Canvas builder wrapper (with provider) ────────────────────────────────────

function CanvasBuilder({ playbookId }: { playbookId: number }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const { data: seqList } = useQuery<PlaybookMeta[]>({ queryKey: ["playbooks"], queryFn: () => apiFetch("/api/playbooks").then(r => r.json()) });
  const seq = seqList?.find(s => s.id === playbookId);

  async function handleSave(nodes: Node<PlaybookNodeData>[], edges: Edge[]) {
    setSaving(true);
    try {
      const canvas = JSON.stringify({ nodes, edges });
      await apiFetch(`/api/playbooks/${playbookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: canvas }),
      });
      qc.invalidateQueries({ queryKey: ["playbooks"] });
      toast({ title: "Saved", description: "Playbook canvas saved." });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleNameChange(name: string) {
    await apiFetch(`/api/playbooks/${playbookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    qc.invalidateQueries({ queryKey: ["playbooks"] });
  }

  if (!seq) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading playbook…
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <CanvasInner
        playbookId={playbookId}
        playbookName={seq.name}
        playbookStatus={seq.status}
        onNameChange={handleNameChange}
        onBack={() => navigate("/playbooks")}
        onSave={handleSave}
        saving={saving}
      />
    </ReactFlowProvider>
  );
}

// ── Playbooks list view ───────────────────────────────────────────────────────

function PlaybooksList() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showCanned, setShowCanned] = useState(false);

  const { data: playbooks = [], isLoading } = useQuery<PlaybookMeta[]>({
    queryKey: ["playbooks"],
    queryFn: () => apiFetch("/api/playbooks").then(r => r.json()),
  });

  async function createPlaybook(name: string) {
    setCreating(true);
    try {
      const res = await apiFetch("/api/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || "Untitled Playbook" }),
      });
      const seq: PlaybookMeta = await res.json();
      qc.invalidateQueries({ queryKey: ["playbooks"] });
      navigate(`/playbooks/${seq.id}`);
    } catch {
      toast({ title: "Failed to create playbook", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function deletePlaybook(id: number) {
    await apiFetch(`/api/playbooks/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["playbooks"] });
    localStorage.removeItem(`playbook_canvas_${id}`);
    toast({ title: "Deleted" });
  }

  const CATEGORY_COLORS: Record<string, string> = {
    draft: "bg-secondary text-muted-foreground border-border/60",
    active: "bg-green-50 text-green-700 border-green-200",
    paused: "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-foreground">Playbooks</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Build and manage your multi-touch outreach sequences</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCanned(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-secondary/40 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Templates
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Playbook
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading playbooks…
          </div>
        ) : playbooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="h-14 w-14 rounded-2xl bg-secondary/60 border border-border/60 flex items-center justify-center">
              <GitBranch className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No playbooks yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start from scratch or choose a proven template.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowNew(true)} className="px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-secondary/40 transition-colors">Start from Scratch</button>
              <button onClick={() => setShowCanned(true)} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Choose a Template</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 max-w-4xl">
            {playbooks.map(pb => {
              const storageKey = `playbook_canvas_${pb.id}`;
              let blockCount = 0;
              try { const raw = localStorage.getItem(storageKey); if (raw) { const cs = JSON.parse(raw) as CanvasState; blockCount = cs.nodes.length; } } catch {}
              return (
                <div
                  key={pb.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:shadow-sm transition-all cursor-pointer group"
                  onClick={() => navigate(`/playbooks/${pb.id}`)}
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <GitBranch className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{pb.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">Updated {formatRelative(pb.updatedAt)}</span>
                      {blockCount > 0 && <span className="text-[11px] text-muted-foreground">{blockCount} block{blockCount !== 1 ? "s" : ""}</span>}
                      {pb.enrollmentCount > 0 && <span className="text-[11px] text-muted-foreground">{pb.enrollmentCount} enrolled</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", CATEGORY_COLORS[pb.status] ?? CATEGORY_COLORS.draft)}>
                      {pb.status ?? "draft"}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); deletePlaybook(pb.id); }}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New playbook inline form */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-96 p-5 flex flex-col gap-4">
            <p className="text-sm font-bold">New Playbook</p>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") createPlaybook(newName); if (e.key === "Escape") setShowNew(false); }}
              placeholder="Playbook name…"
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-secondary/40">Cancel</button>
              <button
                onClick={() => createPlaybook(newName)}
                disabled={creating}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
              >
                {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <CannedLibraryModal
        open={showCanned}
        onClose={() => setShowCanned(false)}
        onSelect={async (canned) => {
          setCreating(true);
          try {
            const res = await apiFetch("/api/playbooks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: canned.name }),
            });
            const seq: PlaybookMeta = await res.json();
            const state = canned.build();
            localStorage.setItem(`playbook_canvas_${seq.id}`, JSON.stringify(state));
            qc.invalidateQueries({ queryKey: ["playbooks"] });
            navigate(`/playbooks/${seq.id}`);
          } finally {
            setCreating(false);
          }
        }}
      />
    </div>
  );
}

// ── Shell wrapper for list view ───────────────────────────────────────────────

import { Shell } from "@/components/layout/Shell";

function PlaybooksListPage() {
  return <Shell><PlaybooksList /></Shell>;
}

// ── Route dispatch ────────────────────────────────────────────────────────────

export default function Playbooks() {
  const [matchDetail, params] = useRoute("/playbooks/:id");
  if (matchDetail && params?.id) {
    const id = parseInt(params.id);
    if (!isNaN(id)) return <CanvasBuilder playbookId={id} />;
  }
  return <PlaybooksListPage />;
}
