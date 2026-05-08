
import type { Story } from "@/types";
import { Badge } from "@/components/ui/badge";

type Props = {
  story: Story;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (storyId: string) => void;
};

export default function StoryCard({
  story,
  selectable,
  selected,
  onToggleSelect,
}: Props) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        selected ? "border-slate-900 bg-slate-50" : "bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{story.id}</Badge>
        <Badge variant="outline">{story.kind}</Badge>
        <Badge variant="outline">{story.estimate}</Badge>
      </div>

      <p className="mt-3 font-semibold text-slate-900">{story.title}</p>
      <p className="mt-2 text-sm text-slate-600">Owner: {story.owner}</p>

      {story.dependsOn.length > 0 ? (
        <p className="mt-2 text-sm text-slate-600">
          Depends on: {story.dependsOn.join(", ")}
        </p>
      ) : null}

      {story.labels.length > 0 ? (
        <p className="mt-2 text-sm text-slate-600">
          Labels: {story.labels.join(", ")}
        </p>
      ) : null}

      {story.acceptance.length > 0 ? (
        <div className="mt-3">
          <p className="text-sm font-medium text-slate-900">Acceptance</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {story.acceptance.map((item, idx) => (
              <li key={`${story.id}-acc-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {selectable && onToggleSelect ? (
        <button
          type="button"
          className="mt-4 rounded-xl border px-3 py-2 text-sm"
          onClick={() => onToggleSelect(story.id)}
        >
          {selected ? "Deselect" : "Select"}
        </button>
      ) : null}
    </div>
  );
}
