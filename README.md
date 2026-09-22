# Wango University Knowledge Base — First Vertical Slice

Scope: **UBC × Undergraduate Engineering Admission × Engineering × 2027**

This is a deliberately narrow slice of `KNOWLEDGE_BASE_ARCHITECTURE.md` (Rev. 3),
built only to prove the pipeline:

```
Official Sources -> AI Research -> Evidence -> Fact Extraction -> Academic Year ->
Applicability/Scope -> Source Citation -> Verification -> Human Review -> VERIFIED Knowledge
```

## What's implemented (and only this)

Domain entities: `University`, `AdmissionCategory`, `Program`.
Support entities: `Source`, `Evidence`, `Fact`, `Conflict`, `ResearchSession`.

`Specialization`, `Career`, `Comparison`, `DecisionQuestion`, `WangoAnalysis` remain
architecture-only for this slice — see KNOWLEDGE_BASE_ARCHITECTURE.md §21 row 13.

## Stack

Next.js (App Router) + TypeScript + SQLite (Node's built-in `node:sqlite` — no
native compilation, no extra dependency, still a real file-backed SQLite database).

## Commands (all run by Claude, not by Wango — see architecture §17)

- `npm run seed` — runs the real UBC Engineering research session seed
  (src/seed/seed-ubc-engineering.ts). Every Fact it creates starts at
  NEEDS_REVIEW or NOT_VERIFIED; nothing is pre-verified.
- `npm test` — vitest suite covering the 14 required invariants.
- `npm run typecheck` / `npm run build` / `npm run lint`.
- `npm run dev` — starts the review UI at http://localhost:3000.

## Where every invariant is enforced

`src/db/repo.ts` is the single place that enforces: No Source→No Fact, AI cannot
create a VERIFIED fact, AI cannot resolve a Conflict, a SUPERSEDED source can never
back a VERIFIED fact, applicability defaults to an explicit "UNSPECIFIED — confirm
applicability" marker rather than silently meaning "all", and Facts are append-only
via `supersedeFact` / `superseded_by_fact_id`.
