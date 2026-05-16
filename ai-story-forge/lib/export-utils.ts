import { Buffer } from "buffer";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { Story } from "@/types";

export type ExportFormat = "json" | "md" | "csv" | "txt" | "docx" | "pdf";
export type ExportScope = "all" | "epics" | "stories";

export type ExportRunInput = {
  title: string;
  date: string;
  stories: Story[];
};

function filterStoriesByScope(
  stories: Story[],
  scope: ExportScope
): Story[] {
  if (scope === "epics") return stories.filter((item) => item.kind === "Epic");
  if (scope === "stories") return stories.filter((item) => item.kind === "Story");
  return stories;
}

function sanitizeFileName(input: string) {
  return (
    input
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 120) || "export"
  );
}

function storyToSerializable(story: Story) {
  return {
    id: story.id,
    kind: story.kind,
    title: story.title,
    estimate: story.estimate,
    storyPoints: story.storyPoints ?? null,
    owner: story.owner,
    storyFormat: story.storyFormat ?? null,
    acceptanceCriteria: story.acceptance ?? [],
    edgeCases: story.edgeCases ?? [],
    dependsOn: story.dependsOn ?? [],
    labels: story.labels ?? [],
  };
}

function buildMarkdown(input: ExportRunInput, scope: ExportScope) {
  const filtered = filterStoriesByScope(input.stories, scope);

  const lines: string[] = [];
  lines.push(`# ${input.title}`);
  lines.push("");
  lines.push(`- Export date: ${input.date}`);
  lines.push(`- Scope: ${scope}`);
  lines.push(`- Items: ${filtered.length}`);
  lines.push("");

  filtered.forEach((story) => {
    lines.push(`## ${story.title}`);
    lines.push("");
    lines.push(`- ID: ${story.id}`);
    lines.push(`- Kind: ${story.kind}`);
    lines.push(`- Estimate: ${story.estimate}`);
    if (typeof story.storyPoints === "number") {
      lines.push(`- Story points: ${story.storyPoints}`);
    }
    lines.push(`- Owner: ${story.owner}`);

    if (story.storyFormat) {
      lines.push("");
      lines.push(`**Story format**`);
      lines.push("");
      lines.push(story.storyFormat);
    }

    if (story.labels?.length) {
      lines.push("");
      lines.push(`**Labels**`);
      lines.push("");
      story.labels.forEach((label) => lines.push(`- ${label}`));
    }

    if (story.dependsOn?.length) {
      lines.push("");
      lines.push(`**Depends on**`);
      lines.push("");
      story.dependsOn.forEach((dep) => lines.push(`- ${dep}`));
    }

    if (story.acceptance?.length) {
      lines.push("");
      lines.push(`**Acceptance criteria**`);
      lines.push("");
      story.acceptance.forEach((item) => lines.push(`- ${item}`));
    }

    if (story.edgeCases?.length) {
      lines.push("");
      lines.push(`**Edge cases**`);
      lines.push("");
      story.edgeCases.forEach((item) => lines.push(`- ${item}`));
    }

    lines.push("");
  });

  return lines.join("\n");
}

function buildPlainText(input: ExportRunInput, scope: ExportScope) {
  const filtered = filterStoriesByScope(input.stories, scope);

  const lines: string[] = [];
  lines.push(`${input.title}`);
  lines.push("=".repeat(input.title.length));
  lines.push(`Export date: ${input.date}`);
  lines.push(`Scope: ${scope}`);
  lines.push(`Items: ${filtered.length}`);
  lines.push("");

  filtered.forEach((story) => {
    lines.push(`${story.title}`);
    lines.push("-".repeat(story.title.length));
    lines.push(`ID: ${story.id}`);
    lines.push(`Kind: ${story.kind}`);
    lines.push(`Estimate: ${story.estimate}`);
    if (typeof story.storyPoints === "number") {
      lines.push(`Story points: ${story.storyPoints}`);
    }
    lines.push(`Owner: ${story.owner}`);

    if (story.storyFormat) {
      lines.push("");
      lines.push("Story format:");
      lines.push(story.storyFormat);
    }

    if (story.labels?.length) {
      lines.push("");
      lines.push("Labels:");
      story.labels.forEach((label) => lines.push(`- ${label}`));
    }

    if (story.dependsOn?.length) {
      lines.push("");
      lines.push("Depends on:");
      story.dependsOn.forEach((dep) => lines.push(`- ${dep}`));
    }

    if (story.acceptance?.length) {
      lines.push("");
      lines.push("Acceptance criteria:");
      story.acceptance.forEach((item) => lines.push(`- ${item}`));
    }

    if (story.edgeCases?.length) {
      lines.push("");
      lines.push("Edge cases:");
      story.edgeCases.forEach((item) => lines.push(`- ${item}`));
    }

    lines.push("");
  });

  return lines.join("\n");
}

function escapeCsv(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsv(input: ExportRunInput, scope: ExportScope) {
  const filtered = filterStoriesByScope(input.stories, scope);

  const header = [
    "id",
    "kind",
    "title",
    "estimate",
    "storyPoints",
    "owner",
    "storyFormat",
    "acceptanceCriteria",
    "edgeCases",
    "dependsOn",
    "labels",
  ];

  const rows = filtered.map((story) => [
    story.id,
    story.kind,
    story.title,
    story.estimate,
    story.storyPoints ?? "",
    story.owner,
    story.storyFormat ?? "",
    (story.acceptance ?? []).join(" | "),
    (story.edgeCases ?? []).join(" | "),
    (story.dependsOn ?? []).join(" | "),
    (story.labels ?? []).join(" | "),
  ]);

  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
    .join("\n");
}

async function buildDocx(input: ExportRunInput, scope: ExportScope) {
  const filtered = filterStoriesByScope(input.stories, scope);

  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun(input.title)],
    }),
    new Paragraph({
      children: [new TextRun(`Export date: ${input.date}`)],
    }),
    new Paragraph({
      children: [new TextRun(`Scope: ${scope}`)],
    }),
    new Paragraph({
      children: [new TextRun(`Items: ${filtered.length}`)],
    }),
    new Paragraph({ children: [new TextRun("")] }),
  ];

  filtered.forEach((story) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun(story.title)],
      }),
      new Paragraph({ children: [new TextRun(`ID: ${story.id}`)] }),
      new Paragraph({ children: [new TextRun(`Kind: ${story.kind}`)] }),
      new Paragraph({
        children: [new TextRun(`Estimate: ${story.estimate}`)],
      }),
      new Paragraph({
        children: [
          new TextRun(
            `Story points: ${
              typeof story.storyPoints === "number" ? story.storyPoints : "N/A"
            }`
          ),
        ],
      }),
      new Paragraph({ children: [new TextRun(`Owner: ${story.owner}`)] })
    );

    if (story.storyFormat) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("Story format")],
        }),
        new Paragraph({ children: [new TextRun(story.storyFormat)] })
      );
    }

    if (story.labels?.length) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("Labels")],
        })
      );
      story.labels.forEach((item) => {
        children.push(new Paragraph({ text: `• ${item}` }));
      });
    }

    if (story.dependsOn?.length) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("Depends on")],
        })
      );
      story.dependsOn.forEach((item) => {
        children.push(new Paragraph({ text: `• ${item}` }));
      });
    }

    if (story.acceptance?.length) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("Acceptance criteria")],
        })
      );
      story.acceptance.forEach((item) => {
        children.push(new Paragraph({ text: `• ${item}` }));
      });
    }

    if (story.edgeCases?.length) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("Edge cases")],
        })
      );
      story.edgeCases.forEach((item) => {
        children.push(new Paragraph({ text: `• ${item}` }));
      });
    }

    children.push(new Paragraph({ children: [new TextRun("")] }));
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

async function buildPdf(input: ExportRunInput, scope: ExportScope) {
  const filtered = filterStoriesByScope(input.stories, scope);

  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let y = 800;
  const fontSize = 11;
  const lineHeight = 15;
  const margin = 40;
  const maxWidth = 515;

  function wrapText(text: string, width: number) {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(test, fontSize);
      if (testWidth <= width) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }

    if (current) lines.push(current);
    return lines;
  }

  function ensurePage() {
    if (y < 50) {
      page = pdfDoc.addPage([595, 842]);
      y = 800;
    }
  }

  function writeLine(text: string, heading = false) {
    const lines = wrapText(text, maxWidth);

    for (const line of lines) {
      ensurePage();
      page.drawText(line, {
        x: margin,
        y,
        size: heading ? 12 : fontSize,
        font,
      });
      y -= lineHeight;
    }
  }

  writeLine(input.title, true);
  writeLine(`Export date: ${input.date}`);
  writeLine(`Scope: ${scope}`);
  writeLine(`Items: ${filtered.length}`);
  writeLine("");

  filtered.forEach((story) => {
    writeLine(story.title, true);
    writeLine(`ID: ${story.id}`);
    writeLine(`Kind: ${story.kind}`);
    writeLine(`Estimate: ${story.estimate}`);
    writeLine(
      `Story points: ${
        typeof story.storyPoints === "number" ? story.storyPoints : "N/A"
      }`
    );
    writeLine(`Owner: ${story.owner}`);

    if (story.storyFormat) {
      writeLine("Story format:", true);
      writeLine(story.storyFormat);
    }

    if (story.labels?.length) {
      writeLine("Labels:", true);
      story.labels.forEach((item) => writeLine(`• ${item}`));
    }

    if (story.dependsOn?.length) {
      writeLine("Depends on:", true);
      story.dependsOn.forEach((item) => writeLine(`• ${item}`));
    }

    if (story.acceptance?.length) {
      writeLine("Acceptance criteria:", true);
      story.acceptance.forEach((item) => writeLine(`• ${item}`));
    }

    if (story.edgeCases?.length) {
      writeLine("Edge cases:", true);
      story.edgeCases.forEach((item) => writeLine(`• ${item}`));
    }

    writeLine("");
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export async function createExportFile(params: {
  format: ExportFormat;
  scope: ExportScope;
  title: string;
  date: string;
  stories: Story[];
}) {
  const safeTitle = sanitizeFileName(params.title);
  const filtered = filterStoriesByScope(params.stories, params.scope);

  if (params.format === "json") {
    const json = JSON.stringify(
      {
        title: params.title,
        date: params.date,
        scope: params.scope,
        itemCount: filtered.length,
        items: filtered.map(storyToSerializable),
      },
      null,
      2
    );

    return {
      buffer: Buffer.from(json, "utf8"),
      filename: `${safeTitle}.json`,
      contentType: "application/json",
    };
  }

  if (params.format === "md") {
    const markdown = buildMarkdown(
      {
        title: params.title,
        date: params.date,
        stories: params.stories,
      },
      params.scope
    );

    return {
      buffer: Buffer.from(markdown, "utf8"),
      filename: `${safeTitle}.md`,
      contentType: "text/markdown; charset=utf-8",
    };
  }

  if (params.format === "csv") {
    const csv = buildCsv(
      {
        title: params.title,
        date: params.date,
        stories: params.stories,
      },
      params.scope
    );

    return {
      buffer: Buffer.from(csv, "utf8"),
      filename: `${safeTitle}.csv`,
      contentType: "text/csv; charset=utf-8",
    };
  }

  if (params.format === "txt") {
    const txt = buildPlainText(
      {
        title: params.title,
        date: params.date,
        stories: params.stories,
      },
      params.scope
    );

    return {
      buffer: Buffer.from(txt, "utf8"),
      filename: `${safeTitle}.txt`,
      contentType: "text/plain; charset=utf-8",
    };
  }

  if (params.format === "docx") {
    const buffer = await buildDocx(
      {
        title: params.title,
        date: params.date,
        stories: params.stories,
      },
      params.scope
    );

    return {
      buffer,
      filename: `${safeTitle}.docx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  if (params.format === "pdf") {
    const buffer = await buildPdf(
      {
        title: params.title,
        date: params.date,
        stories: params.stories,
      },
      params.scope
    );

    return {
      buffer,
      filename: `${safeTitle}.pdf`,
      contentType: "application/pdf",
    };
  }

  throw new Error("Unsupported export format");
}
