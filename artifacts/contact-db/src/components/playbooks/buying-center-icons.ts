import { Megaphone, Wallet, Vote, Crown, Briefcase, Cpu, ShieldCheck, ShoppingCart, Scale, Calculator, User, Wrench, MessageCircle, Ban, GraduationCap, Users, type LucideIcon } from "lucide-react";

/** Matches the seat icons displayed in HQ. */
const icons: Record<string, LucideIcon> = {
  "Business Champion": Megaphone, "Economic Buyer": Wallet, "Decision Maker": Vote,
  "Executive Sponsor": Crown, "Business Owner": Briefcase, "Technical Buyer": Cpu,
  "Security or Compliance Reviewer": ShieldCheck, Procurement: ShoppingCart,
  Legal: Scale, Finance: Calculator, "End User": User, Implementer: Wrench,
  Influencer: MessageCircle, Blocker: Ban, Coach: GraduationCap,
};
export const buyingCenterIcon = (seat: string): LucideIcon => icons[seat] ?? Users;
