
import { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
};

export default function SidebarItem({
  icon: Icon,
  label,
  active,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
``
