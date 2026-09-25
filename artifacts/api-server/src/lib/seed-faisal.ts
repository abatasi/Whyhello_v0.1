/**
 * Seed: Faisal Karmali at CIBC Wood Gundy
 *
 * Adds CIBC Wood Gundy as a company, Faisal Karmali as a contact, and rich
 * outside-in signals across all six categories (personal, company, industry,
 * role, colleague, counterpart).  The function is idempotent — it checks for
 * existence before inserting and skips gracefully if data is already present.
 */

import { db } from "@workspace/db";
import {
  companiesTable,
  contactsTable,
  contactInsightsTable,
  companyInsightsTable,
  colleagueInsightsTable,
  counterpartInsightsTable,
  industriesTable,
  rolesTable,
} from "@workspace/db/schema";
import { and, eq, sql } from "drizzle-orm";

// ── Company ────────────────────────────────────────────────────────────────

const CIBC_COMPANY = {
  name: "CIBC Wood Gundy",
  industry: "Wealth Management",
  size: "1000+",
  location: "Toronto, ON",
  country: "Canada",
  website: "https://cibcwg.com",
  description:
    "CIBC Wood Gundy is the full-service brokerage arm of CIBC, offering personalized investment management, financial planning, and wealth advisory services to high-net-worth and ultra-high-net-worth Canadians.",
  employeeCount: 1800,
  foundedYear: 1888,
  linkedinUrl: "https://linkedin.com/company/cibc-wood-gundy",
};

// ── Company-level outside-in signals ─────────────────────────────────────────

const CIBC_COMPANY_INSIGHTS = [
  {
    title: "CIBC Wood Gundy Named Best Full-Service Brokerage in Canada for Third Consecutive Year",
    url: "https://www.cibc.com/en/about-cibc/news/2025/01-cibc-wg-award.html",
    source: "CIBC Newsroom",
    mediaType: "press_release",
    description:
      "CIBC Wood Gundy has been recognized for the third consecutive year as Canada's top full-service brokerage, with judges citing its advisor satisfaction scores, platform investments, and depth of financial planning support for high-net-worth clients.",
    publishedDate: "Jan 2025",
  },
  {
    title: "CIBC Private Wealth Surpasses $500 Billion in Client Assets Under Administration",
    url: "https://www.cibc.com/en/about-cibc/news/2024/11-private-wealth-aua.html",
    source: "CIBC Newsroom",
    mediaType: "press_release",
    description:
      "CIBC's Private Wealth division — which includes CIBC Wood Gundy — has crossed the $500 billion AUA milestone, driven by net new asset growth and strong markets. The announcement signals continued advisor headcount investment and digital planning tool rollouts.",
    publishedDate: "Nov 2024",
  },
  {
    title: "CIBC Wood Gundy Expands Ultra-High-Net-Worth Practice Capabilities Across Western Canada",
    url: "https://www.cibc.com/en/about-cibc/news/2025/03-uhnw-western-expansion.html",
    source: "CIBC Newsroom",
    mediaType: "press_release",
    description:
      "CIBC Wood Gundy is expanding its team and service infrastructure in Vancouver, Calgary, and Edmonton to meet rising demand from ultra-high-net-worth clients, including business owners, professional athletes, and tech executives seeking integrated estate and investment solutions.",
    publishedDate: "Mar 2025",
  },
];

// ── Contact ───────────────────────────────────────────────────────────────────

const FAISAL_CONTACT = {
  firstName: "Faisal",
  lastName: "Karmali",
  jobTitle: "Portfolio Manager & Senior Wealth Advisor",
  department: "Private Wealth",
  seniority: "Director",
  email: "faisal.karmali@cibcwg.example.com",
  phone: "+1 604-555-2400",
  location: "Vancouver, BC",
  country: "Canada",
  linkedinUrl: "https://linkedin.com/in/faisalkarmali",
  bio: "Known as 'The Athlete's Advisor', Faisal Karmali manages over $500M in assets for professional athletes, business owners, and tech executives. He specializes in helping high-income earners build lasting wealth beyond their peak earning years.",
};

// ── Personal outside-in signals (contact_insights) ───────────────────────────

const FAISAL_PERSONAL_INSIGHTS = [
  {
    category: "personal",
    title: "The 3 Financial Mistakes I See Pro Athletes Make in Year 1 of Their Contract",
    url: "https://www.linkedin.com/pulse/3-financial-mistakes-pro-athletes-faisal-karmali",
    source: "LinkedIn",
    mediaType: "linkedin_post",
    description:
      "Faisal's most-shared post outlines the three patterns he consistently sees in newly wealthy athletes: lifestyle inflation before tax planning, underestimating career length risk, and treating investment accounts as savings accounts. The post generated 4,200 reactions and sparked wide discussion about financial literacy in professional sports.",
    publishedDate: "Dec 2024",
  },
  {
    category: "personal",
    title: "The Athlete's Advisor Podcast — Ep. 47: Managing $10M Before You're 30",
    url: "https://open.spotify.com/episode/karmali-athletes-advisor-ep47",
    source: "Spotify",
    mediaType: "podcast",
    description:
      "Faisal breaks down the exact wealth planning framework he uses with clients who come into sudden wealth early: the liquidity reserve structure, the investment policy statement process, real estate vs. market allocation decisions, and how to think about income volatility as a core portfolio input.",
    publishedDate: "Oct 2024",
  },
  {
    category: "personal",
    title: "Meet the Advisor Who Speaks Athlete: How Faisal Karmali Built a $500M Practice Around Pro Sports",
    url: "https://www.theglobeandmail.com/investing/faisal-karmali-athletes-advisor-2024",
    source: "The Globe and Mail",
    mediaType: "article",
    description:
      "A long-form profile on Faisal Karmali's career and methodology, tracing his path from a general practice to a hyper-focused niche serving professional athletes across the NHL, CFL, and NBA. The piece covers his client onboarding philosophy, how he talks about risk with competitors in sport, and his views on the gap between financial product sales and genuine wealth planning.",
    publishedDate: "Sep 2024",
  },
  {
    category: "personal",
    title: "Why I Measure Success by AUM Growth Last — and What I Track Instead",
    url: "https://www.linkedin.com/posts/faisalkarmali-advisor-metrics-2025",
    source: "LinkedIn",
    mediaType: "linkedin_post",
    description:
      "Faisal challenges the industry's fixation on AUM as the primary success metric for advisors, arguing that client financial confidence scores, asset consolidation rates, and referral velocity are far better signals. The post reveals how he evaluates his own practice and what he looks for when hiring.",
    publishedDate: "Mar 2025",
  },
  {
    category: "personal",
    title: "Keynote: Wealth Planning for Elite Performers — YPO Gold Vancouver Chapter",
    url: "https://www.youtube.com/watch?v=karmali-ypo-vancouver-2024",
    source: "YouTube",
    mediaType: "video",
    description:
      "Recorded keynote from the YPO Gold Vancouver chapter event where Faisal presents his 'Elite Performer Wealth Framework' — a planning model built around three phases: accumulation, protection, and transition. He covers the unique tax and estate challenges of high-earning professionals with compressed career windows.",
    publishedDate: "Jun 2024",
  },
];

// ── Colleague outside-in signals (colleague_insights) ────────────────────────

const FAISAL_COLLEAGUE_INSIGHTS = [
  {
    title: "The 5 Estate Planning Conversations Every Business Owner Should Have Before 55",
    url: "https://www.linkedin.com/pulse/estate-planning-business-owners-cibc-wg-2025",
    source: "LinkedIn",
    mediaType: "linkedin_post",
    description:
      "Published by Faisal's CIBC Wood Gundy colleague Jonathan Park, this widely-shared post outlines the critical estate planning inflection points for business owners: shareholder agreements, corporate-owned life insurance, succession readiness, and the timing of trust structures. Park is a senior estate planner on the same Vancouver team.",
    publishedDate: "Feb 2025",
  },
  {
    title: "CIBC Wood Gundy Vancouver Team Recognized as Top-5 Private Wealth Team in Canada",
    url: "https://www.advisorchannel.ca/cibc-wg-vancouver-top-team-2025",
    source: "Advisor Channel",
    mediaType: "article",
    description:
      "The CIBC Wood Gundy Vancouver team — which includes Faisal Karmali and six other advisors — has been recognized in Advisor Channel's annual ranking of Canada's top private wealth teams. The profile highlights the team's integrated approach to investment management, tax planning, and insurance for high-net-worth clients.",
    publishedDate: "Apr 2025",
  },
];

// ── Counterpart outside-in signals (counterpart_insights) ─────────────────────

const FAISAL_COUNTERPART_INSIGHTS = [
  {
    title: "Why I Left CIBC to Build My Own Practice — And What I'd Tell Advisors Still at the Banks",
    url: "https://www.linkedin.com/pulse/left-cibc-independent-advisory-practice-lessons",
    source: "LinkedIn",
    mediaType: "linkedin_post",
    description:
      "A viral post from an advisor who built a $300M AUM practice inside CIBC Wood Gundy before going independent. He credits bank infrastructure for his early growth but argues that advisor autonomy, payout rates, and investment platform flexibility drove his move. The post surfaces recurring client objections to bank-owned advice models.",
    publishedDate: "Jan 2025",
  },
  {
    title: "The Rise of Independent Wealth Management: Are Bank-Owned Advisors Losing the HNW Client?",
    url: "https://wealthprofessional.ca/rise-independent-wealth-management-bank-advisors-hnw",
    source: "Wealth Professional",
    mediaType: "article",
    description:
      "An industry analysis piece examining the competitive dynamics between bank-owned advisors and independent multi-family offices for high-net-worth mandates above $3M. The piece includes survey data on what HNW clients most value — planning depth, objectivity, investment access — and where bank-owned models score weakest.",
    publishedDate: "Feb 2025",
  },
];

// ── Main export ───────────────────────────────────────────────────────────────

export async function seedFaisalKarmali() {
  // 1. Check / insert CIBC Wood Gundy company
  const [existingCompany] = await db
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .where(eq(companiesTable.name, CIBC_COMPANY.name))
    .limit(1);

  let companyId: number;
  if (existingCompany) {
    companyId = existingCompany.id;
    console.log("Faisal seed: CIBC Wood Gundy already exists, id =", companyId);
  } else {
    const [inserted] = await db
      .insert(companiesTable)
      .values(CIBC_COMPANY)
      .returning({ id: companiesTable.id });
    companyId = inserted.id;
    console.log("Faisal seed: CIBC Wood Gundy created, id =", companyId);
  }

  // 2. Seed company-level insights (idempotent: skip if already present)
  const [{ n: existingCompanyInsights }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(companyInsightsTable)
    .where(eq(companyInsightsTable.companyId, companyId));

  if (existingCompanyInsights === 0) {
    await db.insert(companyInsightsTable).values(
      CIBC_COMPANY_INSIGHTS.map((i) => ({ companyId, ...i }))
    );
    console.log(`Faisal seed: ${CIBC_COMPANY_INSIGHTS.length} company insights added.`);
  }

  // 3. Resolve Wealth Management industry + Investment Advisor role
  const [wealthIndustry] = await db
    .select({ id: industriesTable.id })
    .from(industriesTable)
    .where(eq(industriesTable.name, "Wealth Management"))
    .limit(1);

  const [advisorRole] = await db
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(eq(rolesTable.name, "Investment Advisor"))
    .limit(1);

  // 4. Check / insert Faisal Karmali contact
  const [existingContact] = await db
    .select({ id: contactsTable.id })
    .from(contactsTable)
    .where(
      and(
        eq(contactsTable.firstName, FAISAL_CONTACT.firstName),
        eq(contactsTable.lastName, FAISAL_CONTACT.lastName)
      )
    )
    .limit(1);

  let contactId: number;
  if (existingContact) {
    contactId = existingContact.id;
    console.log("Faisal seed: Faisal Karmali already exists, id =", contactId);
    // Ensure industry / role are set
    await db
      .update(contactsTable)
      .set({
        companyId,
        industryId: wealthIndustry?.id ?? null,
        roleId: advisorRole?.id ?? null,
      })
      .where(eq(contactsTable.id, contactId));
  } else {
    const [inserted] = await db
      .insert(contactsTable)
      .values({
        ...FAISAL_CONTACT,
        companyId,
        industryId: wealthIndustry?.id ?? null,
        roleId: advisorRole?.id ?? null,
      })
      .returning({ id: contactsTable.id });
    contactId = inserted.id;
    console.log("Faisal seed: Faisal Karmali created, id =", contactId);
  }

  // 5. Personal insights (contact_insights)
  const [{ n: existingPersonal }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(contactInsightsTable)
    .where(eq(contactInsightsTable.contactId, contactId));

  if (existingPersonal === 0) {
    const uniqueInsights = [...new Map(FAISAL_PERSONAL_INSIGHTS.map((insight) => [insight.url, insight])).values()];
    const inserted = await db.insert(contactInsightsTable).values(
      uniqueInsights.map((i) => ({ contactId, ...i }))
    ).returning({ id: contactInsightsTable.id });
    console.log(`Faisal seed: ${inserted.length} personal insights added.`);
  }

  // 6. Colleague insights
  const [{ n: existingColleague }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(colleagueInsightsTable)
    .where(eq(colleagueInsightsTable.contactId, contactId));

  if (existingColleague === 0) {
    await db.insert(colleagueInsightsTable).values(
      FAISAL_COLLEAGUE_INSIGHTS.map((i) => ({ contactId, ...i }))
    );
    console.log(`Faisal seed: ${FAISAL_COLLEAGUE_INSIGHTS.length} colleague insights added.`);
  }

  // 7. Counterpart insights
  const [{ n: existingCounterpart }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(counterpartInsightsTable)
    .where(eq(counterpartInsightsTable.contactId, contactId));

  if (existingCounterpart === 0) {
    await db.insert(counterpartInsightsTable).values(
      FAISAL_COUNTERPART_INSIGHTS.map((i) => ({ contactId, ...i }))
    );
    console.log(`Faisal seed: ${FAISAL_COUNTERPART_INSIGHTS.length} counterpart insights added.`);
  }

  console.log("Faisal seed: complete.");
}
