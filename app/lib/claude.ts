export interface BusinessData {
  businessName: string;
  industry: string;
  employeeCount: number | string;
  annualRevenue?: string;
  city: string;
  county?: string;
  entityType?: string;
  yearsInBusiness?: number | string;
  isMinorityOwned?: boolean;
  isWomanOwned?: boolean;
  isVeteranOwned?: boolean;
  specificNeeds?: string;
  isPro?: boolean;
}

export function buildReportPrompt(data: BusinessData): string {
  const ownershipFlags: string[] = [];
  if (data.isMinorityOwned) ownershipFlags.push("minority-owned");
  if (data.isWomanOwned) ownershipFlags.push("woman-owned");
  if (data.isVeteranOwned) ownershipFlags.push("veteran-owned");

  const ownershipLine =
    ownershipFlags.length > 0
      ? `Business ownership: ${ownershipFlags.join(", ")}`
      : "No special ownership designation provided";

  const needsLine = data.specificNeeds
    ? `Current focus / planned use of funds: ${data.specificNeeds}`
    : "No specific use stated — surface the broadest relevant opportunities";

  const scope = data.isPro
    ? `Generate a FULL PRO REPORT with a minimum of 25 distinct opportunities across all 8 required sections. Every opportunity must be real, specific to this business, and actionable.`
    : `Generate a preview report covering the top 3 sections only (Federal Programs, Texas State Programs, Tax Credits), with 2–3 opportunities each.`;

  return `
${scope}

---
BUSINESS PROFILE
Business name: ${data.businessName}
Industry / sector: ${data.industry}
Location: ${data.city}${data.county ? `, ${data.county} County` : ''}, Texas
Entity type: ${data.entityType || "Not provided"}
Number of employees: ${data.employeeCount}
Annual revenue: ${data.annualRevenue || "Not provided"}
Years in business: ${data.yearsInBusiness || "Not provided"}
${ownershipLine}
${needsLine}
---

${data.isPro ? `REQUIRED SECTIONS FOR PRO REPORT:

1. **Federal Grants & SBA Programs** — 5–7 opportunities. SBA loans, USDA programs, DOE, DOL, EDA grants, SBIR/STTR if applicable. Include estimated value, eligibility match, and where to apply.

2. **Texas State Programs** — 4–6 opportunities. Texas Enterprise Fund, Skills Development Fund, Texas Capital Fund, Governor's University Research Initiative, Texas Product Fund, industry-specific state programs. Include administering agency, estimated value, and application path.

3. **Local / City / County Programs** — 3–5 opportunities specific to ${data.city} and surrounding county. Economic development grants, small business loan programs, city incentives. Be honest if you cannot verify a local program exists.

4. **Tax Credits & Deductions** — 4–5 credits. Work Opportunity Tax Credit (WOTC), R&D tax credit, Section 179, energy efficiency credits, Texas franchise tax deductions, payroll tax credits. Include estimated annual value.

5. **Certification Pathways** — 3–4 certifications this business should pursue. HUBZone, 8(a) Business Development, Women-Owned Small Business (WOSB), Veteran-Owned Small Business (VOSB), Texas HUB certification, minority business certifications. Include what doors each opens.

6. **Government Contracting Opportunities** — 2–3 opportunities. SAM.gov registration steps, relevant set-aside contract categories, SBIR/STTR if industry qualifies, local government procurement.

7. **Industry-Specific Programs** — 3–4 niche opportunities for ${data.industry}. Trade association grants, industry foundation funding, sector-specific SBA programs, professional association resources.

8. **30-Day Action Plan** — 8 concrete steps ranked from easiest win to most effort. Include: agency name, real phone number or URL where known, exact action to take, and estimated time required.`
    : `REPORT SECTIONS:

1. **Federal Grants & Programs** — Top 2–3 federal opportunities. Include program name, estimated value, eligibility match, and where to apply.

2. **Texas State Programs** — Top 2–3 Texas-specific opportunities. Include agency, estimated value, and application path.

3. **Tax Credits & Deductions** — Top 2–3 credits they're likely missing. Include estimated annual value.`}

---
Be honest about uncertainty. If a program might not apply, say so. If eligibility is borderline, flag it. The goal is real intelligence they can act on — not a feel-good list.
`;
}

export function buildPreviewPrompt(data: Pick<BusinessData, "industry" | "city" | "employeeCount">): string {
  return `
Give a Texas small business owner in the ${data.industry} industry, based in ${data.city} with ${data.employeeCount} employees, their top 3 most actionable funding opportunities available right now.

Keep it brief: one paragraph per opportunity. Include the program name, estimated value, and one action they can take today. Plain language, no jargon.
`;
}
