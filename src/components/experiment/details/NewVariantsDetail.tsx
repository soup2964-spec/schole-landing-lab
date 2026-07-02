import Link from "next/link";
import { LandingPagePreview } from "@/components/LandingPagePreview";
import { staticReplicaPath } from "@/lib/replica/paths";
import type { PageVariant } from "@/lib/schema/page";

export function NewVariantsDetail({ variants }: { variants: PageVariant[] }) {
  const bred = variants.filter((v) => v.generation > 0);

  if (bred.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No bred variants yet — the optimizer breeds new pages after Generation 0 completes.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {bred.map((v) => {
        const src = staticReplicaPath(v.id);
        return (
          <article
            key={v.id}
            className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm"
          >
            {src ? (
              <LandingPagePreview src={src} title={v.name} />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-slate-50 text-xs text-slate-400">
                {v.id}
              </div>
            )}
            <div className="space-y-2 border-t border-slate-100 px-4 py-3">
              <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                Gen {v.generation} · bred variant
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{v.name}</h3>
              <p className="text-xs leading-relaxed text-slate-600">{v.thesis}</p>
              {v.parentIds.length > 0 && (
                <p className="text-xs text-slate-500">Parents: {v.parentIds.join(" + ")}</p>
              )}
              <Link
                href={`/v/${v.id}`}
                target="_blank"
                className="inline-flex rounded-lg bg-schole-primary px-3 py-2 text-sm font-semibold text-white hover:bg-schole-primary-hover"
              >
                View page
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
