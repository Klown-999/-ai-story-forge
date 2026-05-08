
import type { Story } from "@/types";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ExportFormat = "json" | "md" | "csv" | "txt" | "docx" | "pdf";
export type ExportScope = "all" | "epics" | "stories";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function filterStoriesByScope(
  stories: Story[],
  scope: ExportScope
): Story[] {
  if (scope === "epics") return stories.filter((story) => story.kind === "Epic");
  if (scope === "stories") return stories.filter((story) => story.kind === "Story");
  return stories;
}

export function buildTextExport(title: string, stories: Story[]) {
  const lines: string[] = [];
  lines.push(title);
  lines.push("=".repeat(title.length));
  lines.push("");

  for (const story of stories) {
    lines.push(`${story.id} [${story.kind}]`);
    lines.push(story.title);
    lines.push(`Estimate: ${story.estimate}`);
    lines.push(`Owner: ${story.owner}`);
    lines.push(`Depends on: ${story.dependsOn.join(", ") || "None"}`);
    lines.push(`Labels: ${story.labels.join(", ") || "None"}`);
    lines.push("Acceptance:");
    for (const item of story.acceptance) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function buildMarkdownExport(title: string, stories: Story[]) {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");

  for (const story of stories) {
    lines.push(`## ${story.id} — ${story.title}`);
    lines.push("");
    lines.push(`- **Kind:** ${story.kind}`);
    lines.push(`- **Estimate:** ${story.estimate}`);
    lines.push(`- **Owner:** ${story.owner}`);
    lines.push(`- **Depends on:** ${story.dependsOn.join(", ") || "None"}`);
    lines.push(`- **Labels:** ${story.labels.join(", ") || "None"}`);
    lines.push("");
    lines.push(`### Acceptance Criteria`);
    lines.push("");
    for (const item of story.acceptance) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function buildCsvExport(stories: Story[]) {
  const rows = [
    [
      "id",
      "kind",
      "title",
      "estimate",
      "owner",
      "dependsOn",
      "labels",
      "acceptance",
    ],
    ...stories.map((story) => [
      story.id,
      story.kind,
      story.title,
      story.estimate,
      story.owner,
      story.dependsOn.join("|"),
      story.labels.join("|"),
      story.acceptance.join("|"),
    ]),
  ];

  return rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
}

export function buildJsonExport(title: string, stories: Story[]) {
  return JSON.stringify(
    {
      title,
      storyCount: stories.length,
      exportedAt: new Date().toISOString(),
      stories,
    },
    null,
    2
  );
}

export async function buildDocxExport(title: string, stories: Story[]) {
  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 32 })],
    }),
    new Paragraph(""),
  ];

  for (const story of stories) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `${story.id} — ${story.title}`, bold: true })],
      }),
      new Paragraph(`Kind: ${story.kind}`),
      new Paragraph(`Estimate: ${story.estimate}`),
      new Paragraph(`Owner: ${story.owner}`),
      new Paragraph(`Depends on: ${story.dependsOn.join(", ") || "None"}`),
      new Paragraph(`Labels: ${story.labels.join(", ") || "None"}`),
      new Paragraph("Acceptance Criteria:"),
      ...story.acceptance.map((item) => new Paragraph(`• ${item}`)),
      new Paragraph("")
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function wrapText(text: string, maxChars = 95) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export async function buildPdfExport(title: string, stories: Story[]) {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]); // A4 portrait
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const marginLeft = 40;
  const marginTop = 40;
  const pageHeight = 842;
  const lineHeight = 14;

  let cursorY = pageHeight - marginTop;

  const addLine = (
    text: string,
    options?: {
      bold?: boolean;
      size?: number;
      color?: [number, number, number];
      indent?: number;
      gapAfter?: number;
    }
  ) => {
    const size = options?.size ?? 11;
    const indent = options?.indent ?? 0;
    const color = options?.color ?? [0, 0, 0];
    const gapAfter = options?.gapAfter ?? 0;

    if (cursorY < 60) {
      page = pdfDoc.addPage([595, 842]);
      cursorY = pageHeight - marginTop;
    }

    page.drawText(text, {
      x: marginLeft + indent,
      y: cursorY,
      size,
      font: options?.bold ? fontBold : font,
      color: rgb(color[0], color[1], color[2]),
    });

    cursorY -= size + 4 + gapAfter;
  };

  addLine(title, { bold: true, size: 20, gapAfter: 8 });
  addLine(`Exported at: ${new Date().toISOString()}`, {
    size: 10,
    color: [0.35, 0.35, 0.35],
    gapAfter: 12,
  });

  for (const story of stories) {
    addLine(`${story.id} — ${story.title}`, {
      bold: true,
      size: 13,
      gapAfter: 2,
    });

    addLine(`Kind: ${story.kind}`);
    addLine(`Estimate: ${story.estimate}`);
    addLine(`Owner: ${story.owner}`);
    addLine(`Depends on: ${story.dependsOn.join(", ") || "None"}`);
    addLine(`Labels: ${story.labels.join(", ") || "None"}`, { gapAfter: 4 });

    addLine("Acceptance Criteria:", { bold: true, gapAfter: 2 });

    if (story.acceptance.length === 0) {
      addLine("• None", { indent: 10 });
    } else {
      for (const item of story.acceptance) {
        const wrapped = wrapText(`• ${item}`, 88);
        wrapped.forEach((line, index) => {
          addLine(line, { indent: 10 + (index > 0 ? 10 : 0) });
        });
      }
    }

    cursorY -= 8;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
