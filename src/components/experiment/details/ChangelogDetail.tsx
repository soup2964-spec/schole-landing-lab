import type { PageVariant } from "@/lib/schema/page";

export function ChangelogDetail({ variants }: { variants: PageVariant[] }) {
  const bred = variants.filter((v) => v.generation > 0 && v.changelog?.length);

  if (bred.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Changelogs appear when the optimizer breeds variants with evidence-backed copy changes.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {bred.map((v) => (
        <div key={v.id}>
          <h3 className="text-sm font-semibold text-slate-900">
            {v.name}{" "}
            <code className="ml-1 text-xs font-normal text-slate-500">{v.id}</code>
          </h3>
          <ol className="mt-3 space-y-3">
            {v.changelog!.map((c, i) => (
              <li key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="font-medium text-slate-900">{c.what}</p>
                <p className="mt-1 text-sm text-slate-600">{c.why}</p>
                <p className="mt-2 text-xs text-schole-primary">
                  Evidence: {c.evidence}
                  {c.sourceVariantId && (
                    <span className="text-slate-500"> · from {c.sourceVariantId}</span>
                  )}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
