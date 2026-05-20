
import type { Story } from "@/types";

type JiraMyselfResponse = {
  accountId: string;
  emailAddress?: string;
  displayName: string;
};

type JiraProjectResponse = {
  id: string;
  key: string;
  name: string;
};

type JiraIssueCreateResponse = {
  id: string;
  key: string;
  self: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function getJiraConfig() {
  const baseUrl = requiredEnv("JIRA_BASE_URL").replace(/\/+$/, "");
  const email = requiredEnv("JIRA_EMAIL");
  const apiToken = requiredEnv("JIRA_API_TOKEN");
  const projectKey = requiredEnv("JIRA_PROJECT_KEY");
  const issueType = process.env.JIRA_ISSUE_TYPE || "Story";
  const storyPointsFieldId = process.env.JIRA_STORY_POINTS_FIELD_ID || "";

  return {
    baseUrl,
    email,
    apiToken,
    projectKey,
    issueType,
    storyPointsFieldId,
  };
}

function jiraAuthHeaders() {
  const { email, apiToken } = getJiraConfig();
  const basic = Buffer.from(`${email}:${apiToken}`).toString("base64");

  return {
    Authorization: `Basic ${basic}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function jiraFetch(path: string, init?: RequestInit) {
  const { baseUrl } = getJiraConfig();

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...jiraAuthHeaders(),
      ...(init?.headers || {}),
    },
  });

  return response;
}

function textNode(text: string) {
  return { type: "text", text };
}

function paragraph(text: string) {
  return {
    type: "paragraph",
    content: [textNode(text)],
  };
}

function bulletList(items: string[]) {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [
        {
          type: "paragraph",
          content: [textNode(item)],
        },
      ],
    })),
  };
}

function buildStoryDescriptionAdf(story: Story) {
  const content: any[] = [];

  content.push(paragraph(`ID: ${story.id}`));
  content.push(paragraph(`Estimate: ${story.estimate}`));

  if (typeof story.storyPoints === "number") {
    content.push(paragraph(`Story points: ${story.storyPoints}`));
  }

  content.push(paragraph(`Owner: ${story.owner}`));

  if (story.storyFormat) {
    content.push(paragraph("Story format"));
    content.push(paragraph(story.storyFormat));
  }

  if (story.labels?.length) {
    content.push(paragraph("Labels"));
    content.push(bulletList(story.labels));
  }

  if (story.dependsOn?.length) {
    content.push(paragraph("Depends on"));
    content.push(bulletList(story.dependsOn));
  }

  if (story.acceptance?.length) {
    content.push(paragraph("Acceptance criteria"));
    content.push(bulletList(story.acceptance));
  }

  if (story.edgeCases?.length) {
    content.push(paragraph("Edge cases"));
    content.push(bulletList(story.edgeCases));
  }

  return {
    type: "doc",
    version: 1,
    content,
  };
}

export async function testJiraConnection() {
  const { projectKey } = getJiraConfig();

  const myselfResponse = await jiraFetch("/rest/api/3/myself", {
    method: "GET",
  });

  if (!myselfResponse.ok) {
    const text = await myselfResponse.text();
    throw new Error(
      text || `Failed Jira auth test (${myselfResponse.status})`
    );
  }

  const myself =
    (await myselfResponse.json()) as JiraMyselfResponse;

  const projectResponse = await jiraFetch(
    `/rest/api/3/project/${encodeURIComponent(projectKey)}`,
    {
      method: "GET",
    }
  );

  if (!projectResponse.ok) {
    const text = await projectResponse.text();
    throw new Error(
      text || `Failed Jira project test (${projectResponse.status})`
    );
  }

  const project =
    (await projectResponse.json()) as JiraProjectResponse;

  return {
    user: {
      accountId: myself.accountId,
      displayName: myself.displayName,
      emailAddress: myself.emailAddress,
    },
    project: {
      id: project.id,
      key: project.key,
      name: project.name,
    },
  };
}

export async function createJiraIssueFromStory(story: Story) {
  const { projectKey, issueType, baseUrl, storyPointsFieldId } = getJiraConfig();

  const fields: Record<string, unknown> = {
    project: { key: projectKey },
    summary: story.title,
    issuetype: { name: issueType },
    description: buildStoryDescriptionAdf(story),
    labels: Array.from(new Set(story.labels || [])),
  };

  // Optional native story points field if you know its field ID
  if (storyPointsFieldId && typeof story.storyPoints === "number") {
    fields[storyPointsFieldId] = story.storyPoints;
  }

  const response = await jiraFetch("/rest/api/3/issue", {
    method: "POST",
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to create Jira issue (${response.status})`);
  }

  const created =
    (await response.json()) as JiraIssueCreateResponse;

  return {
    id: created.id,
    key: created.key,
    self: created.self,
    browseUrl: `${baseUrl}/browse/${created.key}`,
  };
}
