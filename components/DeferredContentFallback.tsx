export function DeferredContentFallback({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center">
      <div className="flex items-center gap-3 text-slate-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}
