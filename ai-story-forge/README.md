# -ai-story-forge
AI tool to generate Agile stories from PRDs

# AI Requirements Decomposer & Story Forge

## Project Overview
AI Requirements Decomposer & Story Forge is a web-based AI tool that helps Product Managers and Business Analysts transform a Product Requirements Document (PRD) into a structured, sprint-ready Agile backlog.

The system currently supports:
- PRD input via paste or document upload
- AI-driven requirement quality analysis
- autonomous background refinement of low-quality PRDs
- epic and story generation
- acceptance criteria and edge-case generation
- story-point / estimate generation
- dependency graph visualization
- export-ready backlog generation

## Proposal Alignment
This project is based on the objective of:
- accepting PRD input,
- decomposing features into well-formed Agile user stories,
- identifying requirement quality issues,
- generating a dependency graph,
- and optionally integrating with Jira later.

## Current Status
Implemented:
- PRD paste/upload
- PDF / DOCX / Markdown / text parsing
- AI decomposition pipeline
- requirement quality analysis with severity levels
- autonomous refinement summary
- interactive dependency graph
- exports (JSON / Markdown / CSV / TXT / DOCX / PDF)
- role-based access and run persistence

Deferred:
- Jira write-back (optional feature)

## Tech Stack
- **Frontend:** Next.js / React
- **Backend:** Next.js server routes + background worker
- **Database:** SQLite
- **AI Providers:** Gemini primary, Groq fallback
- **Graph:** React Flow
- **Exports:** JSON / Markdown / CSV / TXT / DOCX / PDF

## Project Structure
```text
app/                     # routes and pages
components/              # UI components
lib/                     # API, AI pipeline, DB, exports, jobs
scripts/                 # background worker
sample-prds/             # showcase/demo PRDs
