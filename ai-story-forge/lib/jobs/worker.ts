
import {
  addRunActivity,
  listQueuedGenerationJobs,
  markGenerationJobFailed,
  markGenerationJobProcessing,
  markGenerationJobReady,
  replaceStoriesForRun,
  StoryRow,
  upsertRunQualityReport,
  upsertRunRefinementSummary,
  updateRunGeneratedMetadata,
} from "@/lib/security-db";
import { runStructuredDecompositionPipeline } from "@/lib/ai/pipeline";
import type { Epic, GeneratedStory } from "@/lib/ai/schemas";

function mapAiOutputToStoryRows(params: {
  runId: string;
  epics: Epic[];
  stories: GeneratedStory[];
}): StoryRow[] {
  const shortRunId = params.runId.slice(0, 8);

  const epicIdMap = new Map<string, string>();
  const storyIdMap = new Map<string, string>();

  const rows: StoryRow[] = [];

  // Create epic rows
  params.epics.forEach((epic, index) => {
    const newEpicId = `${shortRunId}-EPIC-${index + 1}`;
    epicIdMap.set(epic.id, newEpicId);

    rows.push({
      id: newEpicId,
      kind: "Epic",
      title: epic.title,
      estimate: "L",
      owner: epic.ownerSuggestion || "Product / Engineering",
      dependsOn: [],
      labels: Array.from(new Set(["epic", ...epic.labels])),
      acceptance: [
        epic.description,
        `Source requirements: ${epic.sourceRequirementIds.join(", ") || "N/A"}`,
      ],
      storyFormat: null,
      storyPoints: null,
      edgeCases: [],
    });
  });

  // Pre-map story IDs
  params.stories.forEach((story, index) => {
    const newStoryId = `${shortRunId}-STORY-${index + 1}`;
    storyIdMap.set(story.id, newStoryId);
  });

  // Create story rows
  params.stories.forEach((story) => {
    const newStoryId = storyIdMap.get(story.id)!;
    const mappedEpicId = epicIdMap.get(story.epicId);

    const mappedDependsOn = story.dependsOn
      .map((dep) => storyIdMap.get(dep) || epicIdMap.get(dep) || dep)
      .filter(Boolean);

    if (mappedEpicId && !mappedDependsOn.includes(mappedEpicId)) {
      mappedDependsOn.unshift(mappedEpicId);
    }

    rows.push({
      id: newStoryId,
      kind: "Story",
      title: story.title,
      estimate: story.estimate,
      owner: story.ownerSuggestion || "Product / Engineering",
      dependsOn: mappedDependsOn,
      labels: Array.from(new Set(story.labels)),
      acceptance: story.acceptanceCriteria,
      storyFormat: story.storyFormat,
      storyPoints: story.storyPoints,
      edgeCases: story.edgeCases,
    });
  });

  return rows;
}

export async function processOneGenerationJob() {
  const jobs = listQueuedGenerationJobs(1);
  const job = jobs[0];

  if (!job) return false;

  const locked = markGenerationJobProcessing(job.job_id);
  if (!locked) return false;

  try {
    console.log(`[job-worker] picked job ${job.job_id} for run ${job.run_id}`);

    addRunActivity({
      runId: job.run_id,
      type: "run_created",
      title: "Generation started",
      description: "Background AI generation is now processing.",
    });

    const aiResult = await runStructuredDecompositionPipeline({
      prdText: job.prd_text,
      userApprovedMajorChanges:
        job.user_approved_major_changes == null
          ? null
          : job.user_approved_major_changes === 1,
    });

    upsertRunQualityReport(job.run_id, aiResult.qualityReport);
    upsertRunRefinementSummary(job.run_id, aiResult.refinementSummary);

    updateRunGeneratedMetadata({
      runId: job.run_id,
      prd: aiResult.refinementSummary.finalCorrectedPrd,
      majorDecision:
        aiResult.refinementSummary.roundsUsed > 0
          ? `Autonomous refinement applied (${aiResult.refinementSummary.roundsUsed} round(s))`
          : "No autonomous refinement needed",
    });

    addRunActivity({
      runId: job.run_id,
      type: "run_created",
      title: "Autonomous refinement completed",
      description: `Used ${aiResult.refinementSummary.roundsUsed}/${aiResult.refinementSummary.maxRefinementRounds} refinement rounds. Final blockers: ${aiResult.refinementSummary.finalCounts.blockers}, warnings: ${aiResult.refinementSummary.finalCounts.warnings}, suggestions: ${aiResult.refinementSummary.finalCounts.suggestions}.`,
    });

    const rows = mapAiOutputToStoryRows({
      runId: job.run_id,
      epics: aiResult.epics,
      stories: aiResult.stories,
    });

    replaceStoriesForRun(job.run_id, rows);

    addRunActivity({
      runId: job.run_id,
      type: "run_created",
      title: "Generation completed",
      description: `Generated ${rows.length} items successfully.`,
    });

    if (aiResult.correction.smallChanges.length > 0) {
      addRunActivity({
        runId: job.run_id,
        type: "run_created",
        title: "Minor corrections applied",
        description: aiResult.correction.smallChanges.join("; "),
      });
    }

    if (aiResult.qualityReport.flags.length > 0) {
      addRunActivity({
        runId: job.run_id,
        type: "run_created",
        title: "Requirement quality issues detected",
        description: `${aiResult.qualityReport.blockerCount} blocker(s), ${aiResult.qualityReport.warningCount} warning(s), ${aiResult.qualityReport.suggestionCount} suggestion(s).`,
      });
    }

    markGenerationJobReady(job.job_id);
    console.log(`[job-worker] completed job ${job.job_id}`);
    return true;
  } catch (error) {
    console.error("[job-worker] background job failed:", error);

    markGenerationJobFailed(
      job.job_id,
      error instanceof Error ? error.message : "Unknown generation failure"
    );

    addRunActivity({
      runId: job.run_id,
      type: "run_created",
      title: "Generation failed",
      description:
        error instanceof Error ? error.message : "Unknown generation failure",
    });

    return true;
  }
}
