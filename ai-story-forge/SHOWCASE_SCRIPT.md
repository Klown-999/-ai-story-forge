## 1. Introduction
“Hello everyone. This project is called **AI Requirements Decomposer & Story Forge**.  
The goal is to reduce the manual effort between a raw Product Requirements Document and a sprint-ready backlog by using AI to refine requirement quality, generate structured stories, and visualize dependencies.”

---

## 2. PRD Input
“Here I can paste a PRD directly or upload a supported file such as PDF, DOCX, Markdown, or text.  
For this demo, I’ll use one of our prepared sample PRDs.”

---

## 3. Trigger Generation
“When I click **Generate stories**, the system creates a background job.  
The AI pipeline first reviews and refines the PRD, then analyzes requirement quality, then decomposes the refined requirements into epics and stories.”

---

## 4. Requirement Quality Report
“This section shows the requirement quality analysis.  
The system flags issues such as ambiguity, missing measurable criteria, undefined actors, and missing non-functional requirements.  
Each issue is categorized as a **Blocker**, **Warning**, or **Suggestion**, with an explanation and a suggested fix.”

---

## 5. Autonomous Refinement Summary
“This section shows how the system refined the PRD in the background before final story generation.  
It compares the number of blockers, warnings, and suggestions before and after refinement.”

---

## 6. Generated Stories
“These are the generated Agile backlog items.  
Each story includes:
- title
- story format
- acceptance criteria
- edge cases
- estimate and story points”

---

## 7. Interactive Dependency Graph
“This graph shows the dependency relationships between backlog items.  
I can click any node to inspect the details in the side panel, which helps identify what should be built first.”

---

## 8. Export
“Finally, the generated backlog can be exported in multiple formats.  
For the showcase, Markdown and CSV are the most useful because they align directly with sprint planning handoff.”

---

## 9. Closing
“To summarize: the system accepts a PRD, improves requirement quality, generates a sprint-ready backlog, visualizes dependencies, and supports export-ready output.  
Jira integration is optional and can be added later, but the core product workflow is already functional and aligned with the project objectives.”