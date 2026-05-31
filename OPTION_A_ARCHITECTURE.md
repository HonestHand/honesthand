# HonestHand — Option A: Elite Infrastructure Architecture

> **Status:** Documented. Not yet authorized for build.
> **Current state:** Option B (MVP stabilization) is active.
> **Purpose:** Define the long-term architecture when market validation justifies the investment.

---

## Why Option A Exists

Option B (current) uses Claude to generate free-form markdown reports, which are then parsed into structured UI components. This works well for MVP but has inherent limits:

- Eligibility logic lives in AI prompts — not deterministic, not auditable
- No persistent opportunity objects — can't track, score, or diff across months
- No structured deadline tracking — deadlines are extracted from text at render time
- No saved-opportunity CRM — bookmarks exist in localStorage only
- No advisor tooling — no way to annotate, flag, or prioritize for a user
- No segmentation engine — nonprofits and businesses share the same pipeline with prompt-level gates

Option A replaces the prompt-as-logic-layer with a proper data model.

---

## Core Concept: Structured Opportunity Objects

Today, an "opportunity" is a block of markdown text.

In Option A, an opportunity is a database record:

```
opportunities
├── id (uuid)
├── name (text)
├── program_type (enum: grant | loan | tax_credit | certification | contracting | resource)
├── eligible_entity_types (text[])        -- ['for_profit', 'nonprofit', 'both']
├── eligible_industries (text[])           -- ['retail', 'healthcare', ...] or ['*']
├── eligible_states (text[])               -- ['TX'] or ['*']
├── veteran_only (boolean)
├── woman_only (boolean)
├── minority_only (boolean)
├── rural_priority (boolean)
├── funding_min (integer)                  -- in cents
├── funding_max (integer)                  -- in cents
├── funding_type (text)                    -- 'non-repayable', 'loan', 'tax_credit'
├── deadline_type (enum: fixed | rolling | annual | tbd)
├── deadline_date (date)
├── deadline_notes (text)
├── agency_name (text)
├── agency_url (text)
├── description (text)
├── qualification_rules (jsonb)            -- structured eligibility conditions
├── is_active (boolean)
├── last_verified_at (timestamptz)
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

---

## Required Schemas / Tables

### `opportunities`
The canonical program database. AI-assisted population + human review.

### `opportunity_matches`
Per-user filtered list of relevant opportunities:
```
├── id
├── user_id (fk → profiles)
├── opportunity_id (fk → opportunities)
├── match_score (0–100)
├── match_reasons (text[])
├── eligibility_flags (jsonb)
├── suppressed (boolean)
├── suppression_reason (text)
├── created_at
└── expires_at
```

### `saved_opportunities`
Replace localStorage bookmarks with server-side persistence:
```
├── id
├── user_id
├── opportunity_id
├── notes (text)
├── status (enum: saved | applied | awarded | declined)
├── applied_at (timestamptz)
└── created_at
```

### `deadline_alerts`
Scheduled notifications for upcoming deadlines:
```
├── id
├── user_id
├── opportunity_id
├── alert_date (date)
├── sent_at (timestamptz)
└── channel (enum: email | sms | push)
```

### `report_versions`
Diff-aware monthly report storage:
```
├── id
├── user_id
├── generated_at
├── opportunity_ids (uuid[])              -- ordered list of matched IDs
├── new_opportunity_ids (uuid[])          -- additions since last report
├── removed_opportunity_ids (uuid[])      -- removals since last report
└── raw_content (text)                    -- backward-compatible markdown
```

### `profiles` (additions)
```
+ industry_detail (text)                  -- e.g. "custom western hat shop"
+ naics_code (text)                       -- for contracting eligibility
+ years_in_business (integer)
+ zip_code (text)                         -- for HUBZone lookup
+ hubzone_eligible (boolean)              -- cached from SBA lookup
```

---

## Eligibility Engine

Replaces prompt-level entity type gates with a deterministic function:

```typescript
function matchOpportunity(
  opp: Opportunity,
  profile: Profile
): MatchResult {
  const reasons: string[] = []
  const failures: string[] = []

  // Entity type gate — hard block
  if (!opp.eligible_entity_types.includes('*')) {
    const profileType = profile.is_501c3 ? 'nonprofit' : 'for_profit'
    if (!opp.eligible_entity_types.includes(profileType)) {
      return { matched: false, suppressed: true, reason: 'entity_type_mismatch' }
    }
  }

  // Veteran gate
  if (opp.veteran_only && !profile.is_veteran) {
    return { matched: false, suppressed: true, reason: 'veteran_only' }
  }

  // Geography gate
  if (!opp.eligible_states.includes('*') && !opp.eligible_states.includes('TX')) {
    return { matched: false, suppressed: true, reason: 'state_ineligible' }
  }

  // Score positive signals
  if (profile.is_veteran && opp.veteran_priority)   reasons.push('Veteran-owned business priority')
  if (profile.is_woman   && opp.woman_priority)     reasons.push('Woman-owned business priority')
  if (opp.rural_priority && isRuralLocation(profile)) reasons.push('Rural Texas location')

  const score = calculateScore(opp, profile, reasons)
  return { matched: true, score, reasons }
}
```

---

## Migration Path from Option B

The migration is designed to be non-breaking:

### Phase 1 — Shadow mode
- Run the eligibility engine alongside Claude generation
- Log mismatches between AI output and deterministic engine
- Build confidence in the engine without showing it to users yet

### Phase 2 — Hybrid rendering
- Use structured opportunity objects for filtering and sorting
- Continue using Claude for narrative descriptions per opportunity
- Display engine-verified eligibility bullets instead of AI-generated ones

### Phase 3 — Full structured mode
- Opportunities come from the database, not Claude output
- Claude is used only for: narrative descriptions, next-step language, local context
- All eligibility decisions are deterministic
- Report generation becomes a matching query, not a generation call

### Data population strategy
- Use Claude in batch mode to populate the `opportunities` table from known programs
- Human review queue for high-value or borderline programs
- Web scraper / scheduled job to check `last_verified_at` and flag stale entries

---

## Current Pain Points This Solves

| Pain Point | Option B (now) | Option A |
|-----------|---------------|----------|
| Nonprofit content shown to for-profit | Prompt gate + post-filter | Hard DB gate before query |
| Bullet fragments / bad qualifiers | Parse-time cleanup | Structured `qualification_rules` field |
| Deadline accuracy | AI-generated, verified at search time | Structured `deadline_date` + `last_verified_at` |
| Report truncation | Token limit management | Paginated structured records |
| Saved opportunities (server-side) | localStorage only | `saved_opportunities` table |
| Monthly diff (what's new) | Full regeneration | `report_versions` diff |
| Advisor tooling | None | Annotation layer on `opportunity_matches` |
| Nonprofit vs business segmentation | Separate prompts | Separate match queries + entity type gate |
| HUBZone eligibility | AI infers from location | Cached SBA API lookup on `zip_code` |
| NAICS-based contracting matches | Broad industry guess | Exact NAICS code matching |

---

## Prerequisite Work Before Option A Build

1. **NAICS code** added to onboarding (or auto-suggested from industry + description)
2. **Zip code** added to onboarding (needed for HUBZone lookup)
3. **Opportunity seed database** — initial batch of ~500 verified Texas-relevant programs
4. **Admin panel** — to review, approve, and update opportunity records
5. **SBA HUBZone API integration** — to auto-flag HUBZone eligibility at signup
6. **Resend or email queue** for deadline alerts

---

## When to Authorize Option A

Recommended trigger points:

- **500+ active pro subscribers** — market validated, worth the infrastructure investment
- **Churn analysis shows "wrong opportunities" as a top reason** — data quality is the growth limiter
- **Advisor/consultant tier is planned** — they need annotation tooling that requires structured data
- **Nonprofit segment is significant** — needs clean separation from the business engine

Until then, Option B with continuous prompt hardening and UI refinement is the right path.
