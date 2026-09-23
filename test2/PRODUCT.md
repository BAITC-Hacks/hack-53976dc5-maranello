# Product
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
React + Vite, existing FastAPI + SQLAlchemy + SQLite API. Backend architecture stays unchanged.

## Users
Business representatives describing problems and student teams proposing solutions during an educational hackathon.

## Product Purpose
Turn a short business problem into a reviewed, structured task and connect it with a student team's proposal.

## Operating Context
Desktop-first live demonstration. Switch between Business and Student Team without registration.

## Capabilities and Constraints
Seven surfaces: overview, create, clarification, editor, catalog, details, proposals.
Use actual API data. Ratings never gate publishing or responding. Team selection is manual.
All ten card fields are editable before publication. The backend supplies scoring and AI analysis with fallback.

## Brand Commitments
The user requests a clean modern SaaS/edtech dashboard, excellent typography, cards, progress bars and badges with minimal noise.
Working assumption pending optional feedback: Russian UI and the temporary name «Практика».

## Evidence on Hand
docs/SPEC.md, docs/API_CONTRACT.md, docs/HANDOFF.md, actual local backend and its seed data. No invented testimonials, users, organizations or activity.

## Product Principles
Keep the next action obvious. Preserve user input on failures. Explain scores without judging ideas. Separate draft completeness from publishing eligibility. Make choices explicit.
