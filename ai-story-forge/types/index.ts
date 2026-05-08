
export type Story = {
  id: string;
  kind: "Epic" | "Story";
  title: string;
  estimate: string;
  owner: string;
  dependsOn: string[];
  labels: string[];
  acceptance: string[];
};

export type StoredRun = {
  id: string;
  title: string;
  date: string;
  stories: number;
  jira: number;
  prd: string;
  generatedStories: Story[];
  majorDecision: string;
  exportedFormats: string[];
  sourceType?: string | null;
  sourceFileName?: string | null;
  lastSavedAt?: string | null;
};
