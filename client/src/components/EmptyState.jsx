export default function EmptyState({ title, message }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 shadow-sm bg-white p-10 text-center">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
    </div>
  );
}
