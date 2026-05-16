
"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Story } from "@/types";

type StoryCardProps = {
  story: Story;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (storyId: string) => void;
};

export default function StoryCard({
  story,
  selectable = false,
  selected = false,
  onToggleSelect,
}: StoryCardProps) {
  return (
    <Card
      className={`rounded-3xl border-slate-200 shadow-sm transition ${
        selected ? "ring-2 ring-slate-900" : ""
      }`}
    >
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              {story.title}
            </CardTitle>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge className="rounded-full">{story.kind}</Badge>
              <Badge variant="outline" className="rounded-full">
                Estimate: {story.estimate}
              </Badge>
              {typeof story.storyPoints === "number" ? (
                <Badge variant="outline" className="rounded-full">
                  Story points: {story.storyPoints}
                </Badge>
              ) : null}
            </div>
          </div>

          {selectable && onToggleSelect ? (
            <Button
              className="rounded-2xl"
              onClick={() => onToggleSelect(story.id)}
            >
              {selected ? "Deselect" : "Select"}
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full">
            Owner: {story.owner}
          </Badge>

          {story.labels.map((label: string) => (
            <Badge key={label} variant="outline" className="rounded-full">
              {label}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {story.storyFormat ? (
          <div>
            <p className="mb-2 font-semibold text-slate-900">Story format</p>
            <div className="rounded-2xl border bg-slate-50 p-3 text-sm text-slate-700">
              {story.storyFormat}
            </div>
          </div>
        ) : null}

        {story.acceptance?.length ? (
          <div>
            <p className="mb-2 font-semibold text-slate-900">
              Acceptance criteria
            </p>
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
              {story.acceptance.map((item: string, index: number) => (
                <li key={`${story.id}-acceptance-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {story.edgeCases?.length ? (
          <div>
            <p className="mb-2 font-semibold text-slate-900">Edge cases</p>
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
              {story.edgeCases.map((item: string, index: number) => (
                <li key={`${story.id}-edge-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {story.dependsOn?.length ? (
          <div>
            <p className="mb-2 font-semibold text-slate-900">Depends on</p>
            <div className="flex flex-wrap gap-2">
              {story.dependsOn.map((dep: string) => (
                <Badge key={dep} variant="outline" className="rounded-full">
                  {dep}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
