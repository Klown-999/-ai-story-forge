
export type Story = {
  id: string;
  kind: "Epic" | "Story";
  title: string;
  estimate: "S" | "M" | "L" | "XL";
  owner: string;
  dependsOn: string[];
  labels: string[];
  acceptance: string[];

  // New richer fields
  storyFormat?: string;
  storyPoints?: number;
  edgeCases?: string[];
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
  lastSavedAt?: string;
};

