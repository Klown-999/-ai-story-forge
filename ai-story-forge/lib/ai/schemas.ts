
import { z } from "zod/v3";

export const RequirementSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z.enum([
    "functional",
    "non_functional",
    "integration",
    "constraint",
    "risk",
  ]),
  priority: z.enum(["high", "medium", "low"]).optional(),
  sourceSection: z.string().optional(),
});

export const PrdStructureSchema = z.object({
  productName: z.string(),
  summary: z.string(),
  userRoles: z.array(z.string()),
  requirements: z.array(RequirementSchema),
  assumptions: z.array(z.string()),
  risks: z.array(z.string()),
  missingInfo: z.array(z.string()),
});

export type PrdStructure = z.infer<typeof PrdStructureSchema>;

export const CorrectionDecisionSchema = z.object({
  severity: z.enum(["low", "high"]),
  correctedPrd: z.string(),
  largeChangeReasons: z.array(z.string()),
  smallChanges: z.array(z.string()),
});

export type CorrectionDecision = z.infer<typeof CorrectionDecisionSchema>;

export const EpicSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  ownerSuggestion: z.string(),
  labels: z.array(z.string()),
  sourceRequirementIds: z.array(z.string()),
});

export type Epic = z.infer<typeof EpicSchema>;

export const StorySchema = z.object({
  id: z.string(),
  epicId: z.string(),
  title: z.string(),

  // Standard agile format required by the proposal
  storyFormat: z.string(),

  // Short implementation-oriented summary
  description: z.string(),

  // Relative estimate for the current UI
  estimate: z.enum(["S", "M", "L", "XL"]),

  // Explicit story points for proposal alignment
  storyPoints: z.number().int().positive(),

  ownerSuggestion: z.string(),
  labels: z.array(z.string()),
  dependsOn: z.array(z.string()),

  acceptanceCriteria: z.array(z.string()),

  // New field required by the proposal
  edgeCases: z.array(z.string()),

  sourceRequirementIds: z.array(z.string()),
});

export type GeneratedStory = z.infer<typeof StorySchema>;

export const DependencySchema = z.object({
  fromStoryId: z.string(),
  toStoryId: z.string(),
  reason: z.string(),
});

export type StoryDependency = z.infer<typeof DependencySchema>;

export const ReviewSchema = z.object({
  coverageGaps: z.array(z.string()),
  duplicateStories: z.array(z.string()),
  weakAcceptanceCriteriaStoryIds: z.array(z.string()),
  dependencyIssues: z.array(z.string()),
  confidence: z.number().min(0).max(100),
});

export type DecompositionReview = z.infer<typeof ReviewSchema>;

export const EpicListSchema = z.object({
  epics: z.array(EpicSchema),
});

export type EpicList = z.infer<typeof EpicListSchema>;

export const StoryBundleSchema = z.object({
  stories: z.array(StorySchema),
  dependencies: z.array(DependencySchema),
});

export type StoryBundle = z.infer<typeof StoryBundleSchema>;

export const RequirementQualitySeveritySchema = z.enum([
  "Blocker",
  "Warning",
  "Suggestion",
]);

export const RequirementQualityCategorySchema = z.enum([
  "Ambiguous language",
  "Contradiction",
  "Undefined actor",
  "Missing non-functional requirement",
  "Passive voice",
  "Missing measurable criteria",
  "Incomplete requirement",
]);

export const RequirementQualityFlagSchema = z.object({
  severity: RequirementQualitySeveritySchema,
  category: RequirementQualityCategorySchema,
  quotedText: z.string(),
  reason: z.string(),
  suggestedFix: z.string(),
  sectionHint: z.string().optional(),
  requirementIds: z.array(z.string()),
});

export type RequirementQualityFlag = z.infer<typeof RequirementQualityFlagSchema>;

export const RequirementQualityReportSchema = z.object({
  summary: z.string(),
  flags: z.array(RequirementQualityFlagSchema),
  blockerCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  suggestionCount: z.number().int().nonnegative(),
});

export type RequirementQualityReport = z.infer<
  typeof RequirementQualityReportSchema
>;

export const QualityFixApplicationSchema = z.object({
  correctedPrd: z.string(),
  appliedChanges: z.array(z.string()),
  skippedIssues: z.array(z.string()),
  summary: z.string(),
});

export type QualityFixApplication = z.infer<
  typeof QualityFixApplicationSchema
>;

export const RefinementCountsSchema = z.object({
  blockers: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
  suggestions: z.number().int().nonnegative(),
});

export type RefinementCounts = z.infer<typeof RefinementCountsSchema>;

export const AutonomousRefinementRoundSchema = z.object({
  round: z.number().int().positive(),
  inputCounts: RefinementCountsSchema,
  outputCounts: RefinementCountsSchema,
  appliedChanges: z.array(z.string()),
  skippedIssues: z.array(z.string()),
  summary: z.string(),
});

export type AutonomousRefinementRound = z.infer<
  typeof AutonomousRefinementRoundSchema
>;

export const AutonomousRefinementSummarySchema = z.object({
  maxRefinementRounds: z.number().int().positive(),
  roundsUsed: z.number().int().nonnegative(),
  stoppedReason: z.enum([
    "quality_threshold_met",
    "max_rounds_reached",
    "no_actionable_issues",
  ]),
  originalCounts: RefinementCountsSchema,
  finalCounts: RefinementCountsSchema,
  finalCorrectedPrd: z.string(),
  rounds: z.array(AutonomousRefinementRoundSchema),
});

export type AutonomousRefinementSummary = z.infer<
  typeof AutonomousRefinementSummarySchema
>;
