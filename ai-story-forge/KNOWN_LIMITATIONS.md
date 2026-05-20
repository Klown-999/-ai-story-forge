
# Known Limitations

## 1. Jira Integration
Jira integration is currently deferred.  
This was intentionally postponed because the project proposal treats Jira write-back as optional, while the main focus has been on the core intelligence and workflow:
- PRD input
- requirement quality analysis
- autonomous refinement
- story generation
- dependency visualization
- export-ready backlog generation

## 2. AI Output Variability
Because the system uses LLM-based structured generation, outputs may vary slightly between runs depending on the PRD wording and model response behavior.

## 3. Graph Scalability
The current graph is optimized for clarity and demo usability.  
Extremely large backlogs may require more advanced graph layout logic in future work.

## 4. Production Hardening
The project is currently focused on academic/project demonstration quality rather than full enterprise production hardening.

## 5. Technical Area Mapping
Although the proposal mentions technical area mapping in the overall goal, the current implementation focuses more strongly on requirement decomposition, quality analysis, dependency graphing, and export.
