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
  /** Free-text description of what the business specifically does */
  businessDescription?: string;
  /** Who the business primarily serves — improves funding prioritization */
  customerSegments?: string[];
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
    : "No specific use stated — surface the broadest relevant opportunities"

  const descriptionLine = data.businessDescription
    ? `Business description: ${data.businessDescription}`
    : null

  const segmentsLine = data.customerSegments?.length
    ? `Primary customers: ${data.customerSegments.join(', ')}`
    : null;

  const scope = data.isPro
    ? `Generate a FULL PRO REPORT with a minimum of 25 distinct opportunities across all 8 required sections. Every opportunity must be real, specific to this business, and actionable.`
    : `Generate a preview report covering the top 3 sections only (Federal Programs, Texas State Programs, Tax Credits), with 2–3 opportunities each.`;

  return `
${scope}

---
BUSINESS PROFILE
Business name: ${data.businessName}
Industry / sector: ${data.industry}${descriptionLine ? `\n${descriptionLine}` : ''}
Location: ${data.city}${data.county ? `, ${data.county} County` : ''}, Texas
Entity type: ${data.entityType || "Not provided"}
Number of employees: ${data.employeeCount}
Annual revenue: ${data.annualRevenue || "Not provided"}
Years in business: ${data.yearsInBusiness || "Not provided"}
${ownershipLine}${segmentsLine ? `\n${segmentsLine}` : ''}
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

8. **30-Day Action Plan** — 8 concrete steps ranked from easiest win to most effort. Include: agency name, real phone number or URL where known, exact action to take, and estimated time required.${data.isVeteranOwned ? `

9. **Veteran Resource Organizations — Free & Discounted Supplies, Equipment & Technology** — 3–5 real organizations that provide tangible non-cash benefits to veteran business owners. Cover free or discounted laptops/computers, software, office supplies, tools, mentorship, and training programs. Examples include Computers for Veterans, Dell Reconnect, PCs for People, Microsoft VETS program, Bunker Labs, SCORE (veteran priority), IVMF at Syracuse, SBA Boots to Business, and Hiring Our Heroes. Only include programs you can verify are currently active. Use the same 4-field format (Value, Deadline, Why you qualify, Next step) for each.` : ''}`
    : `REPORT SECTIONS:

1. **Federal Grants & Programs** — Top 2–3 federal opportunities. Include program name, estimated value, eligibility match, and where to apply.

2. **Texas State Programs** — Top 2–3 Texas-specific opportunities. Include agency, estimated value, and application path.

3. **Tax Credits & Deductions** — Top 2–3 credits they're likely missing. Include estimated annual value.`}

---
Be honest about uncertainty. If a program might not apply, say so. If eligibility is borderline, flag it. The goal is real intelligence they can act on — not a feel-good list.
Return your response as a valid JSON array only with no text before or after the array and no markdown and no explanation and the first character of your response must be an opening bracket and the last character must be a closing bracket.
`;
}

// ─── Nonprofit report ─────────────────────────────────────────────────────────

export interface NonprofitData {
  orgName: string
  missionArea: string
  is501c3: boolean
  ein?: string
  city: string
  county?: string
  populationsServed?: string
  annualBudget?: string
  yearsOperating?: string
  currentPrograms?: string
  fundingGoals?: string
  grantHistory?: string
  orgFocus?: string[]
  fundingTypeNeeds?: string[]
  isPro?: boolean
}

export function buildNonprofitReportPrompt(data: NonprofitData): string {
  const focusLine = data.orgFocus?.length
    ? `Organization focus areas: ${data.orgFocus.join(', ')}`
    : 'No specific focus areas listed'

  const fundingLine = data.fundingTypeNeeds?.length
    ? `Funding needs: ${data.fundingTypeNeeds.join(', ')}`
    : 'General operating and program funding'

  const scope = data.isPro
    ? `Generate a FULL PRO NONPROFIT FUNDING REPORT with a minimum of 25 distinct opportunities across all 8 required sections. Every opportunity must be real, specific to this organization, and actionable.`
    : `Generate a preview nonprofit funding report covering the top 3 sections only (Foundation Grants, Government Grants, Capacity Building), with 2–3 opportunities each.`

  const proSections = `REQUIRED SECTIONS FOR PRO NONPROFIT REPORT:

1. **Foundation Grants — Private & Community Foundations** — 5–7 opportunities. Include private foundations (family, corporate-endowed), Texas community foundations (Communities Foundation of Texas, Houston Endowment, San Antonio Area Foundation, etc.), and national foundations with Texas grantmaking aligned to this mission area. Include estimated grant size, eligibility match, and how to apply.

2. **Federal & Government Grants** — 4–6 opportunities. Match to the org's mission: HHS, HRSA, HUD, DOJ, DOE, USDA, AmeriCorps, NEA, NEH, ACF, SAMHSA, or FEMA Nonprofit Security Grant — whichever apply. Specify program names, not just agencies.

3. **Texas State Funding for Nonprofits** — 3–5 opportunities. Texas Health & Human Services Commission, Texas Education Agency, Texas Commission on the Arts, Texas Parks & Wildlife, Office of the Governor criminal justice division, Texas Workforce Commission, Texas Department of Housing & Community Affairs. Match to mission area.

4. **Local / City / County Funding** — 2–4 opportunities specific to ${data.city}${data.county ? ` and ${data.county} County` : ''}. Local foundation chapters, city budget allocations for nonprofits, county social services contracts, United Way chapter funding. Be honest if local programs are hard to verify for small communities.

5. **Corporate Sponsorships & Giving Programs** — 3–5 opportunities. Texas-headquartered or operating companies with structured nonprofit giving programs aligned to this mission. Include H-E-B, AT&T, ExxonMobil, Frost Bank, Valero, Southwest Airlines, Dell, or others relevant to the mission area. Include application process and typical grant size.

6. **Capacity Building, Technology & Organizational Development** — 3–4 opportunities. Google for Nonprofits (Google Workspace, Ad Grants), Microsoft for Nonprofits, Salesforce.org Power of Us, TechBridge, capacity-building grants from foundations, BoardSource, or training programs. These strengthen the org's infrastructure and grant readiness.

7. **Program-Specific & Mission-Aligned Funding** — 3–4 niche opportunities from national nonprofits, sector-specific funders, or issue-focused foundations directly aligned to this mission area. Be specific — match to ${data.missionArea}.

8. **30-Day Grant Readiness Action Plan** — 8 concrete steps ranked from easiest win to most strategic. Start with free registrations that unlock funding (SAM.gov, GuideStar/Candid profile, grants.gov registration). Include real contact info, URLs, or search instructions. End with the highest-effort but highest-value action.${data.orgFocus?.includes('faith_based') ? `

9. **Faith-Based & Community Organization Grants** — 3–4 opportunities specifically for faith-based nonprofits: FEMA Nonprofit Security Grant Program, HUD Faith and Opportunity Initiative, local interfaith foundation grants, and any applicable denominational mission funds. Note 501(c)(3) requirements for each.` : ''}`

  const freeSections = `REPORT SECTIONS:

1. **Foundation Grants** — Top 2–3 foundation opportunities aligned to this mission area and location. Include estimated grant size and application path.

2. **Government Grants** — Top 2–3 federal or Texas state grants matching this organization's mission and operating budget size.

3. **Capacity Building Resources** — Top 2–3 resources or grants to strengthen the organization (technology, training, operations, or strategic planning support).`

  return `
${scope}

---
NONPROFIT PROFILE
Organization name: ${data.orgName}
Mission area: ${data.missionArea}
501(c)(3) confirmed: ${data.is501c3 ? 'Yes' : 'No / Pending'}
EIN: ${data.ein || 'Not provided'}
Location: ${data.city}${data.county ? `, ${data.county} County` : ''}, Texas
Populations served: ${data.populationsServed || 'Not specified'}
Annual operating budget: ${data.annualBudget || 'Not provided'}
Years operating: ${data.yearsOperating || 'Not provided'}
${focusLine}
${fundingLine}
Grant history: ${data.grantHistory || 'Not provided'}
---

${data.isPro ? proSections : freeSections}

---
Be honest about uncertainty. If a program requires 501(c)(3) status and this org doesn't have it yet, say so and suggest fiscal sponsorship as a near-term path. Flag any opportunities where a small or new organization faces heightened competition — don't oversell. The goal is actionable intelligence, not a feel-good list.
Return your response as a valid JSON array only with no text before or after the array and no markdown and no explanation and the first character of your response must be an opening bracket and the last character must be a closing bracket.
`
}

export function buildPreviewPrompt(data: Pick<BusinessData, "industry" | "city" | "employeeCount">): string {
  return `
Give a Texas small business owner in the ${data.industry} industry, based in ${data.city} with ${data.employeeCount} employees, their top 3 most actionable funding opportunities available right now.

Keep it brief: one paragraph per opportunity. Include the program name, estimated value, and one action they can take today. Plain language, no jargon.
`;
}
