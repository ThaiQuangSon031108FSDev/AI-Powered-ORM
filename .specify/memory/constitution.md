# AI-Powered ORM Constitution

## Core Principles

### I. MVP Simplicity
Keep the architecture straightforward to meet the 7-day Proof of Concept deadline. Next.js API Routes must be used as the primary backend to minimize infrastructure overhead.

### II. AI-Driven Automation
The system's core value is automated response generation. All fetched reviews must be seamlessly processed by OpenAI (GPT-4o-mini) / Gemini API to generate standard, friendly, and error-recovery response options within 5 seconds.

### III. Centralized Dashboard
User interactions must be consolidated into a single Web Dashboard. Status transitions (Pending to Resolved) must be immediate and persistent in the database.

## Technology Constraints
- **Framework**: Next.js (App Router preferred)
- **Styling**: Tailwind CSS
- **Database**: Supabase
- **AI Integrations**: Google Places API (for data pipeline), OpenAI API / Gemini API (for generation).

## Development Workflow
- **Git Strategy**: Daily clear commits pushed to GitHub.
- **Deployment**: Must be fully operational and deployable on Vercel without click-action errors.

## Governance
Amendments to this constitution require justification aligned with the 7-day MVP goal. Complexity that risks the deadline must be rejected.

**Version**: 1.0.0 | **Ratified**: 2026-05-19 | **Last Amended**: 2026-05-19
