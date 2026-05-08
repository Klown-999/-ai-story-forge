
type Props = {
  label: string;
  value: number | string;
  sub?: string;
};

export default function Stat({ label, value, sub }: Props) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {sub ? <p className="mt-2 text-sm text-slate-500">{sub}</p> : null}
    </div>
  );
}
