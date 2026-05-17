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

  return `
Generate a comprehensive HonestHand Opportunity Report for this Texas small business:

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

REPORT REQUIREMENTS:

1. **Federal Grants & Programs** — List 3–5 federal opportunities this business likely qualifies for right now. Include SBA programs, USDA programs, DOE, DOL, etc. For each: program name, estimated value, eligibility match, and the exact website to apply.

2. **Texas State Programs** — List 3–4 Texas-specific grants, incentives, or tax credits. Include Texas Enterprise Fund, Skills Development Fund, Texas Capital Fund, and any industry-specific state programs. For each: program name, administering agency, estimated value, and where to apply.

3. **Local / City Programs** — Based on their city (${data.city}), list any local economic development grants, small business loan programs, or city incentives. Note if you're unsure whether a specific local program exists — don't make things up.

4. **Tax Credits & Deductions** — List 3–4 federal and Texas tax credits they're likely missing. Include Work Opportunity Tax Credit, R&D credits, Section 179, energy credits, etc.

5. **Industry-Specific Opportunities** — Based on their industry (${data.industry}), are there any niche grants, certifications, or set-aside contracts that apply?

6. **30-Day Action Plan** — Give them 5 concrete steps they can take in the next 30 days, ordered by easiest win first. Be specific — include actual agency names, phone numbers if known, or URLs.

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