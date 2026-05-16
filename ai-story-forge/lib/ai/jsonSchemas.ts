
export const correctionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    severity: {
      type: "string",
      enum: ["low", "high"],
    },
    correctedPrd: {
      type: "string",
    },
    largeChangeReasons: {
      type: "array",
      items: { type: "string" },
    },
    smallChanges: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["severity", "correctedPrd", "largeChangeReasons", "smallChanges"],
};

export const prdStructureJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    productName: { type: "string" },
    summary: { type: "string" },
    userRoles: {
      type: "array",
      items: { type: "string" },
    },
    requirements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          type: {
            type: "string",
            enum: [
              "functional",
              "non_functional",
              "integration",
              "constraint",
              "risk",
            ],
          },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
          sourceSection: { type: "string" },
        },
        required: ["id", "text", "type"],
      },
    },
    assumptions: {
      type: "array",
      items: { type: "string" },
    },
    risks: {
      type: "array",
      items: { type: "string" },
    },
    missingInfo: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "productName",
    "summary",
    "userRoles",
    "requirements",
    "assumptions",
    "risks",
    "missingInfo",
  ],
};

export const epicListJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    epics: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          ownerSuggestion: { type: "string" },
          labels: {
            type: "array",
            items: { type: "string" },
          },
          sourceRequirementIds: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "id",
          "title",
          "description",
          "ownerSuggestion",
          "labels",
          "sourceRequirementIds",
        ],
      },
    },
  },
  required: ["epics"],
};

export const storyBundleJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    stories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          epicId: { type: "string" },
          title: { type: "string" },

          storyFormat: { type: "string" },

          description: { type: "string" },

          estimate: {
            type: "string",
            enum: ["S", "M", "L", "XL"],
          },

          storyPoints: {
            type: "number",
          },

          ownerSuggestion: { type: "string" },
          labels: {
            type: "array",
            items: { type: "string" },
          },
          dependsOn: {
            type: "array",
            items: { type: "string" },
          },
          acceptanceCriteria: {
            type: "array",
            items: { type: "string" },
          },

          edgeCases: {
            type: "array",
            items: { type: "string" },
          },

          sourceRequirementIds: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "id",
          "epicId",
          "title",
          "storyFormat",
          "description",
          "estimate",
          "storyPoints",
          "ownerSuggestion",
          "labels",
          "dependsOn",
          "acceptanceCriteria",
          "edgeCases",
          "sourceRequirementIds",
        ],
      },
    },
    dependencies: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          fromStoryId: { type: "string" },
          toStoryId: { type: "string" },
          reason: { type: "string" },
        },
        required: ["fromStoryId", "toStoryId", "reason"],
      },
    },
  },
  required: ["stories", "dependencies"],
};

export const reviewJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    coverageGaps: {
      type: "array",
      items: { type: "string" },
    },
    duplicateStories: {
      type: "array",
      items: { type: "string" },
    },
    weakAcceptanceCriteriaStoryIds: {
      type: "array",
      items: { type: "string" },
    },
    dependencyIssues: {
      type: "array",
      items: { type: "string" },
    },
    confidence: {
      type: "number",
    },
  },
  required: [
    "coverageGaps",
    "duplicateStories",
    "weakAcceptanceCriteriaStoryIds",
    "dependencyIssues",
    "confidence",
  ],
};

export const requirementQualityReportJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    flags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          severity: {
            type: "string",
            enum: ["Blocker", "Warning", "Suggestion"],
          },
          category: {
            type: "string",
            enum: [
              "Ambiguous language",
              "Contradiction",
              "Undefined actor",
              "Missing non-functional requirement",
              "Passive voice",
              "Missing measurable criteria",
              "Incomplete requirement",
            ],
          },
          quotedText: { type: "string" },
          reason: { type: "string" },
          suggestedFix: { type: "string" },
          sectionHint: { type: "string" },
          requirementIds: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "severity",
          "category",
          "quotedText",
          "reason",
          "suggestedFix",
          "requirementIds",
        ],
      },
    },
    blockerCount: { type: "number" },
    warningCount: { type: "number" },
    suggestionCount: { type: "number" },
  },
  required: [
    "summary",
    "flags",
    "blockerCount",
    "warningCount",
    "suggestionCount",
  ],
};

export const qualityFixApplicationJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    correctedPrd: { type: "string" },
    appliedChanges: {
      type: "array",
      items: { type: "string" },
    },
    skippedIssues: {
      type: "array",
      items: { type: "string" },
    },
    summary: { type: "string" },
  },
  required: ["correctedPrd", "appliedChanges", "skippedIssues", "summary"],
};
