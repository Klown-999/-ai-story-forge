
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/authz";
import {
  addRunActivity,
  createRun,
  replaceStoriesForRun,
  StoryRow,
} from "@/lib/security-db";
import { logAuditEvent } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenerateBody = {
  prdText?: string;
  userApprovedMajorChanges?: boolean | null;
  sourceFileName?: string;
  sourceType?: string;
  uploadToken?: string;
};

type ParsedPrd = {
  productName: string;
  overview: string[];
  users: string[];
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  integrations: string[];
  otherSections: Record<string, string[]>;
};

type RequirementBucket =
  | "core-workflow"
  | "auth-security"
  | "reporting-audit"
  | "integrations"
  | "performance-reliability"
  | "collaboration"
  | "data-management"
  | "general";

function normalizeLines(prdText: string) {
  return prdText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function titleFromPrd(prdText: string) {
  const lines = normalizeLines(prdText);

  const productNameLine = lines.find((line) =>
    line.toLowerCase().startsWith("product name:")
  );

  if (productNameLine) {
    return productNameLine.replace(/product name:/i, "").trim();
  }

  return lines[0] || "Generated PRD Run";
}

function parsePrd(prdText: string): ParsedPrd {
  const lines = normalizeLines(prdText);

  let currentSection = "overview";
  const sections: Record<string, string[]> = {
    overview: [],
    users: [],
    functionalRequirements: [],
    nonFunctionalRequirements: [],
    integrations: [],
  };

  let productName = titleFromPrd(prdText);

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (lower.startsWith("product name:")) {
      productName = line.replace(/product name:/i, "").trim() || productName;
      continue;
    }

    if (/^overview:$/i.test(line)) {
      currentSection = "overview";
      continue;
    }

    if (/^users:$/i.test(line) || /^roles:$/i.test(line)) {
      currentSection = "users";
      continue;
    }

    if (
      /^functional requirements:$/i.test(line) ||
      /^requirements:$/i.test(line)
    ) {
      currentSection = "functionalRequirements";
      continue;
    }

    if (/^non-functional requirements:$/i.test(line)) {
      currentSection = "nonFunctionalRequirements";
      continue;
    }

    if (/^integrations:$/i.test(line)) {
      currentSection = "integrations";
      continue;
    }

    const headingMatch = line.match(/^([A-Za-z][A-Za-z0-9 /-]+):$/);
    if (headingMatch) {
      const sectionName = headingMatch[1].trim();
      const safeKey = sectionName
        .replace(/[^A-Za-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

      if (!sections[safeKey]) {
        sections[safeKey] = [];
      }

      currentSection = safeKey;
      continue;
    }

    const cleaned = line.replace(/^[-*•]\s*/, "").trim();
    if (!cleaned) continue;

    if (!sections[currentSection]) {
      sections[currentSection] = [];
    }

    sections[currentSection].push(cleaned);
  }

  return {
    productName,
    overview: sections.overview || [],
    users: sections.users || [],
    functionalRequirements: sections.functionalRequirements || [],
    nonFunctionalRequirements: sections.nonFunctionalRequirements || [],
    integrations: sections.integrations || [],
    otherSections: Object.fromEntries(
      Object.entries(sections).filter(
        ([key]) =>
          ![
            "overview",
            "users",
            "functionalRequirements",
            "nonFunctionalRequirements",
            "integrations",
          ].includes(key)
      )
    ),
  };
}

function sentenceCase(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function choosePrimaryRole(parsed: ParsedPrd) {
  if (parsed.users.length > 0) {
    return parsed.users[0];
  }
  return "user";
}

function inferBucket(requirement: string): RequirementBucket {
  const lower = requirement.toLowerCase();

  if (
    lower.includes("login") ||
    lower.includes("sign in") ||
    lower.includes("authentication") ||
    lower.includes("authorization") ||
    lower.includes("role") ||
    lower.includes("permission") ||
    lower.includes("security")
  ) {
    return "auth-security";
  }

  if (
    lower.includes("audit") ||
    lower.includes("history") ||
    lower.includes("log") ||
    lower.includes("report") ||
    lower.includes("dashboard") ||
    lower.includes("analytics")
  ) {
    return "reporting-audit";
  }

  if (
    lower.includes("integrat") ||
    lower.includes("api") ||
    lower.includes("jira") ||
    lower.includes("sharepoint") ||
    lower.includes("email") ||
    lower.includes("external")
  ) {
    return "integrations";
  }

  if (
    lower.includes("performance") ||
    lower.includes("latency") ||
    lower.includes("availability") ||
    lower.includes("scalability") ||
    lower.includes("reliability") ||
    lower.includes("uptime")
  ) {
    return "performance-reliability";
  }

  if (
    lower.includes("comment") ||
    lower.includes("approve") ||
    lower.includes("share") ||
    lower.includes("review") ||
    lower.includes("collabor")
  ) {
    return "collaboration";
  }

  if (
    lower.includes("data") ||
    lower.includes("save") ||
    lower.includes("storage") ||
    lower.includes("upload") ||
    lower.includes("download") ||
    lower.includes("export") ||
    lower.includes("import")
  ) {
    return "data-management";
  }

  if (
    lower.includes("workflow") ||
    lower.includes("create") ||
    lower.includes("manage") ||
    lower.includes("generate") ||
    lower.includes("edit") ||
    lower.includes("view")
  ) {
    return "core-workflow";
  }

  return "general";
}

function bucketTitle(bucket: RequirementBucket, productName: string) {
  switch (bucket) {
    case "core-workflow":
      return `${productName} Core Workflow`;
    case "auth-security":
      return `${productName} Access & Security`;
    case "reporting-audit":
      return `${productName} Reporting & Audit`;
    case "integrations":
      return `${productName} Integrations`;
    case "performance-reliability":
      return `${productName} Performance & Reliability`;
    case "collaboration":
      return `${productName} Collaboration`;
    case "data-management":
      return `${productName} Data Management`;
    default:
      return `${productName} General Capabilities`;
  }
}

function summarizeRequirementToStoryTitle(requirement: string, primaryRole: string) {
  const cleaned = requirement.replace(/\.$/, "").trim();
  return `As a ${primaryRole}, I want to ${cleaned.toLowerCase()}`;
}

function acceptanceCriteriaForRequirement(requirement: string) {
  const cleaned = requirement.replace(/\.$/, "").trim();
  const lower = cleaned.toLowerCase();

  const criteria = [
    `${sentenceCase(cleaned)} is available in the workflow`,
    `The system validates the expected behavior for: ${lower}`,
    `Users receive clear feedback when the action succeeds or fails`,
  ];

  if (
    lower.includes("upload") ||
    lower.includes("import") ||
    lower.includes("file")
  ) {
    criteria.push("Supported file types and validation rules are enforced");
  }

  if (
    lower.includes("login") ||
    lower.includes("auth") ||
    lower.includes("role") ||
    lower.includes("permission")
  ) {
    criteria.push("Access is enforced according to the configured role permissions");
  }

  if (
    lower.includes("report") ||
    lower.includes("audit") ||
    lower.includes("dashboard")
  ) {
    criteria.push("Relevant activity or summary information is visible to the user");
  }

  if (
    lower.includes("integrat") ||
    lower.includes("api") ||
    lower.includes("external")
  ) {
    criteria.push("Integration errors are handled gracefully and surfaced clearly");
  }

  return Array.from(new Set(criteria)).slice(0, 5);
}

function estimateForRequirement(requirement: string) {
  const lower = requirement.toLowerCase();

  if (
    lower.includes("integrat") ||
    lower.includes("security") ||
    lower.includes("performance") ||
    lower.includes("authorization")
  ) {
    return "L";
  }

  if (
    lower.includes("dashboard") ||
    lower.includes("report") ||
    lower.includes("audit") ||
    lower.includes("workflow") ||
    lower.includes("generate")
  ) {
    return "M";
  }

  return "S";
}

function buildDynamicStories(prdText: string, runId: string): StoryRow[] {
  const parsed = parsePrd(prdText);
  const primaryRole = choosePrimaryRole(parsed);
  const shortRunId = runId.slice(0, 8);

  const requirementBuckets = new Map<RequirementBucket, string[]>();

  const allRequirements = [
    ...parsed.functionalRequirements,
    ...parsed.nonFunctionalRequirements,
    ...parsed.integrations,
  ];

  // Fallback to overview sentences if explicit requirements are missing
  const fallbackRequirements =
    allRequirements.length > 0
      ? allRequirements
      : parsed.overview.map((line) => line.replace(/\.$/, "").trim());

  const usableRequirements =
    fallbackRequirements.length > 0
      ? fallbackRequirements
      : [`manage ${parsed.productName}`, `view ${parsed.productName} outputs`];

  for (const requirement of usableRequirements) {
    const bucket = inferBucket(requirement);
    if (!requirementBuckets.has(bucket)) {
      requirementBuckets.set(bucket, []);
    }
    requirementBuckets.get(bucket)!.push(requirement);
  }

  const stories: StoryRow[] = [];
  let epicCounter = 1;
  let storyCounter = 1;

  for (const [bucket, bucketRequirements] of requirementBuckets.entries()) {
    const epicId = `${shortRunId}-EPIC-${epicCounter++}`;

    stories.push({
      id: epicId,
      kind: "Epic",
      title: bucketTitle(bucket, parsed.productName),
      estimate:
        bucketRequirements.length >= 4
          ? "XL"
          : bucketRequirements.length >= 2
          ? "L"
          : "M",
      owner:
        bucket === "auth-security" || bucket === "integrations"
          ? "Backend"
          : bucket === "reporting-audit"
          ? "Backend / Analytics"
          : "Frontend / Backend",
      dependsOn: [],
      labels: [bucket, "epic"],
      acceptance: [
        `Epic covers the ${bucket.replace(/-/g, " ")} scope for ${parsed.productName}`,
        `Epic aligns with the PRD requirements in this category`,
      ],
    });

    for (const requirement of bucketRequirements) {
      const storyId = `${shortRunId}-STORY-${storyCounter++}`;

      stories.push({
        id: storyId,
        kind: "Story",
        title: summarizeRequirementToStoryTitle(requirement, primaryRole),
        estimate: estimateForRequirement(requirement),
        owner:
          bucket === "auth-security" || bucket === "integrations"
            ? "Backend"
            : bucket === "reporting-audit"
            ? "Backend"
            : "Frontend",
        dependsOn: [epicId],
        labels: [bucket],
        acceptance: acceptanceCriteriaForRequirement(requirement),
      });
    }
  }

  return stories;
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAppUser(["admin", "editor"]);
    if (!authResult.ok) {
      return NextResponse.json(
        { message: authResult.message },
        { status: authResult.status }
      );
    }

    const body = (await request.json()) as GenerateBody;
    const prdText = body.prdText?.trim();

    if (!prdText) {
      return NextResponse.json(
        { message: "prdText is required" },
        { status: 400 }
      );
    }

    const title = titleFromPrd(prdText);
    const today = new Date().toISOString().split("T")[0];

    const runId = createRun({
      ownerUserId: authResult.user.id,
      title,
      date: today,
      prd: prdText,
      majorDecision: "Pending",
      sourceType: body.sourceType ?? null,
      sourceFileName: body.sourceFileName ?? null,
    });

    const stories = buildDynamicStories(prdText, runId);
    replaceStoriesForRun(runId, stories);

    addRunActivity({
      runId,
      type: "run_created",
      title: "Run generated",
      description: `Generated ${stories.length} items dynamically from the PRD.`,
    });

    if (body.sourceFileName) {
      addRunActivity({
        runId,
        type: "source_prd",
        title: "Source file attached",
        description: `${body.sourceFileName} (${body.sourceType || "unknown"})`,
      });
    }

    logAuditEvent({
      userId: authResult.user.id,
      userEmail: authResult.user.email,
      action: "run_generated",
      entityType: "run",
      entityId: runId,
      message: `User generated a new run ${runId}.`,
      metadata: {
        title,
        storyCount: stories.length,
        sourceFileName: body.sourceFileName ?? null,
        sourceType: body.sourceType ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      runId,
      stories,
      summary: {
        storyCount: stories.length,
      },
      correctionPreview: {
        requiresApproval: false,
      },
    });
  } catch (error) {
    console.error("POST /api/stories/generate failed:", error);
    return NextResponse.json(
      { message: "Failed to generate stories" },
      { status: 500 }
    );
  }
}
