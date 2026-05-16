
import {
  correctionJsonSchema,
  epicListJsonSchema,
  prdStructureJsonSchema,
  qualityFixApplicationJsonSchema,
  requirementQualityReportJsonSchema,
  reviewJsonSchema,
  storyBundleJsonSchema,
} from "@/lib/ai/jsonSchemas";

import {
  CorrectionDecisionSchema,
  EpicListSchema,
  PrdStructureSchema,
  QualityFixApplicationSchema,
  RequirementQualityReportSchema,
  ReviewSchema,
  StoryBundleSchema,
  type RequirementQualityReport,
  type RefinementCounts,
} from "@/lib/ai/schemas";

import {
  correctionPrompt,
  epicPrompt,
  prdStructurePrompt,
  qualityAnalysisPrompt,
  qualityFixPrompt,
  reviewPrompt,
  storyPrompt,
} from "@/lib/ai/prompts";

import { callStructuredWithFallback } from "@/lib/ai/router";

export const MAX_REFINEMENT_ROUNDS = 2;

function countsFromReport(report: RequirementQualityReport): RefinementCounts {
  return {
    blockers: report.blockerCount,
    warnings: report.warningCount,
    suggestions: report.suggestionCount,
  };
}

function qualityThresholdMet(report: RequirementQualityReport) {
  return report.blockerCount === 0 && report.warningCount === 0;
}

export async function proposeCorrections(prdText: string) {
  return callStructuredWithFallback({
    system: `${correctionPrompt}

Return all fields always:
- severity
- correctedPrd
- largeChangeReasons (empty array if none)
- smallChanges (empty array if none)

Do not omit any required fields.`,
    user: prdText,
    schemaName: "prd_correction",
    schema: CorrectionDecisionSchema,
    jsonSchema: correctionJsonSchema,
  });
}

export async function extractPrdStructure(prdText: string) {
  return callStructuredWithFallback({
    system: prdStructurePrompt,
    user: prdText,
    schemaName: "prd_structure",
    schema: PrdStructureSchema,
    jsonSchema: prdStructureJsonSchema,
  });
}

export async function analyzeRequirementQuality(input: unknown) {
  return callStructuredWithFallback({
    system: qualityAnalysisPrompt,
    user: JSON.stringify(input, null, 2),
    schemaName: "requirement_quality_report",
    schema: RequirementQualityReportSchema,
    jsonSchema: requirementQualityReportJsonSchema,
  });
}

export async function applyRequirementQualityFixes(input: {
  originalPrd: string;
  qualityReport: unknown;
  acceptedFlags?: unknown[];
}) {
  return callStructuredWithFallback({
    system: qualityFixPrompt,
    user: JSON.stringify(input, null, 2),
    schemaName: "quality_fix_application",
    schema: QualityFixApplicationSchema,
    jsonSchema: qualityFixApplicationJsonSchema,
  });
}

export async function generateEpics(input: unknown) {
  return callStructuredWithFallback({
    system: epicPrompt,
    user: JSON.stringify(input, null, 2),
    schemaName: "epic_list",
    schema: EpicListSchema,
    jsonSchema: epicListJsonSchema,
  });
}

export async function generateStories(input: unknown) {
  return callStructuredWithFallback({
    system: storyPrompt,
    user: JSON.stringify(input, null, 2),
    schemaName: "story_bundle",
    schema: StoryBundleSchema,
    jsonSchema: storyBundleJsonSchema,
  });
}

export async function reviewDecomposition(input: unknown) {
  return callStructuredWithFallback({
    system: reviewPrompt,
    user: JSON.stringify(input, null, 2),
    schemaName: "decomposition_review",
    schema: ReviewSchema,
    jsonSchema: reviewJsonSchema,
  });
}

export async function runStructuredDecompositionPipeline(params: {
  prdText: string;
  userApprovedMajorChanges?: boolean | null;
}) {
  const correction = await proposeCorrections(params.prdText);

  // Autonomous mode: always continue automatically.
  let currentPrd =
    correction.severity === "high"
      ? correction.correctedPrd
      : correction.correctedPrd;

  let currentPrdStructure = await extractPrdStructure(currentPrd);

  let currentQualityReport = await analyzeRequirementQuality({
    originalPrd: params.prdText,
    effectivePrd: currentPrd,
    prdStructure: currentPrdStructure,
  });

  const originalCounts = countsFromReport(currentQualityReport);
  const rounds: Array<{
    round: number;
    inputCounts: RefinementCounts;
    outputCounts: RefinementCounts;
    appliedChanges: string[];
    skippedIssues: string[];
    summary: string;
  }> = [];

  let stoppedReason:
    | "quality_threshold_met"
    | "max_rounds_reached"
    | "no_actionable_issues" = "no_actionable_issues";

  for (let round = 1; round <= MAX_REFINEMENT_ROUNDS; round++) {
    if (qualityThresholdMet(currentQualityReport)) {
      stoppedReason = "quality_threshold_met";
      break;
    }

    if (currentQualityReport.flags.length === 0) {
      stoppedReason = "no_actionable_issues";
      break;
    }

    const fixed = await applyRequirementQualityFixes({
      originalPrd: currentPrd,
      qualityReport: currentQualityReport,
      acceptedFlags: currentQualityReport.flags,
    });

    const nextPrd = fixed.correctedPrd;
    const nextPrdStructure = await extractPrdStructure(nextPrd);

    const nextQualityReport = await analyzeRequirementQuality({
      originalPrd: params.prdText,
      effectivePrd: nextPrd,
      prdStructure: nextPrdStructure,
    });

    rounds.push({
      round,
      inputCounts: countsFromReport(currentQualityReport),
      outputCounts: countsFromReport(nextQualityReport),
      appliedChanges: fixed.appliedChanges,
      skippedIssues: fixed.skippedIssues,
      summary: fixed.summary,
    });

    currentPrd = nextPrd;
    currentPrdStructure = nextPrdStructure;
    currentQualityReport = nextQualityReport;
  }

  if (!qualityThresholdMet(currentQualityReport) && rounds.length >= MAX_REFINEMENT_ROUNDS) {
    stoppedReason = "max_rounds_reached";
  } else if (qualityThresholdMet(currentQualityReport)) {
    stoppedReason = "quality_threshold_met";
  }

  const refinementSummary = {
    maxRefinementRounds: MAX_REFINEMENT_ROUNDS,
    roundsUsed: rounds.length,
    stoppedReason,
    originalCounts,
    finalCounts: countsFromReport(currentQualityReport),
    finalCorrectedPrd: currentPrd,
    rounds,
  };

  const epicList = await generateEpics(currentPrdStructure);

  const storyBundle = await generateStories({
    prdStructure: currentPrdStructure,
    epics: epicList.epics,
  });

  const review = await reviewDecomposition({
    prdStructure: currentPrdStructure,
    epics: epicList.epics,
    stories: storyBundle.stories,
    dependencies: storyBundle.dependencies,
  });

  return {
    correction,
    requiresApproval: false,
    effectivePrd: currentPrd,
    prdStructure: currentPrdStructure,
    qualityReport: currentQualityReport,
    refinementSummary,
    epics: epicList.epics,
    stories: storyBundle.stories,
    dependencies: storyBundle.dependencies,
    review,
  };
}
