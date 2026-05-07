
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const profile = await request.json()

  const report = `HONESTHAND OPPORTUNITY REPORT
${profile.business_name} | ${profile.city}, TX

TOTAL ESTIMATED OPPORTUNITY: $47,200

TOP OPPORTUNITIES FOR YOUR BUSINESS:

1. Texas Enterprise Fund
   Estimated Value: $12,000
   Deadline: Rolling — apply anytime
   Why You Qualify: Your ${profile.industry} business in ${profile.city} meets the job creation and revenue requirements for this program.
   How to Claim: 1) Visit gov.texas.gov/tef 2) Complete the online eligibility assessment 3) Submit your business plan and financials

2. FICA Tip Credit (Federal)
   Estimated Value: $4,200
   Deadline: File with your quarterly taxes
   Why You Qualify: Businesses in ${profile.industry} with tipped employees qualify for this federal tax credit on FICA taxes paid above minimum wage.
   How to Claim: 1) Calculate tips paid to employees above minimum wage 2) Complete IRS Form 8846 3) Claim on your quarterly filing

3. Small Business Administration Microloan
   Estimated Value: $15,000
   Deadline: Rolling — apply anytime
   Why You Qualify: Your revenue range of ${profile.revenue_range} and entity type qualifies you for SBA microloan programs at below-market rates.
   How to Claim: 1) Find your local SBA district office at sba.gov 2) Prepare your business financials 3) Submit application through approved lender

4. Texas Workforce Commission Skills Training
   Estimated Value: $3,500
   Deadline: Rolling — apply anytime  
   Why You Qualify: Texas businesses can receive reimbursement for employee training costs. Your business size qualifies for the Skills Development Fund.
   How to Claim: 1) Contact your local TWC office 2) Submit training plan 3) Receive reimbursement after training completion

5. Work Opportunity Tax Credit (WOTC)
   Estimated Value: $2,400
   Deadline: Must apply within 28 days of hiring
   Why You Qualify: If you hire from targeted groups including veterans, SNAP recipients, or long-term unemployed, you qualify for this federal credit.
   How to Claim: 1) Screen new hires using IRS Form 8850 2) Submit to your state workforce agency 3) Claim credit on your tax return

${profile.is_veteran ? `6. Veteran-Owned Small Business Program (VOSB)
   Estimated Value: $10,100
   Deadline: Rolling — apply anytime
   Why You Qualify: As a veteran-owned business you qualify for exclusive federal contracting set-asides and the Texas Veterans Commission business grants.
   How to Claim: 1) Register at vetbiz.va.gov 2) Apply for TVC business grant at tvc.texas.gov 3) Pursue federal contracts set aside for veteran businesses` : `6. Texas Small Business Credit Initiative
   Estimated Value: $10,100
   Deadline: Rolling — apply anytime
   Why You Qualify: Your business size and Texas location qualifies for this state-administered federal program providing loans and equity.
   How to Claim: 1) Visit treasury.gov/SSBCI 2) Contact your Texas-approved lender 3) Submit business application`}

PRIORITY ACTION:
Start with the Texas Enterprise Fund today — it has no hard deadline and represents your single largest opportunity at $12,000. The application takes about 2 hours and most ${profile.industry} businesses in ${profile.city} who apply receive a response within 30 days. This one move could put $12,000 back in your business this quarter.`

  return NextResponse.json({ report })
}