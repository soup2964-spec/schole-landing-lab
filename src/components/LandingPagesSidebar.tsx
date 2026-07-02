import Link from "next/link";
import { allVariants } from "@/lib/registry";
import { staticReplicaPath } from "@/lib/replica/paths";

function PageTile({ variant }: { variant: ReturnType<typeof allVariants>[number] }) {
  const src = staticReplicaPath(variant.id);

  return (
    <Link
      href={`/v/${variant.id}`}
      target="_blank"
      className="group block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-schole-primary hover:shadow-md"
    >
      {src ? (
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-50">
          <iframe
            src={src}
            title={variant.name}
            className="pointer-events-none h-[640px] w-[400%] origin-top-left scale-[0.2] border-0"
            tabIndex={-1}
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-slate-50 text-xs text-slate-400">
          {variant.id}
        </div>
      )}
      <div className="border-t border-slate-100 px-3 py-2">
        <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-schole-primary">
          {variant.name}
        </p>
        <p className="truncate font-mono text-[10px] text-slate-500">{variant.id}</p>
      </div>
    </Link>
  );
}

/** Full-page grid of Generation-0 landing page runs only. */
export function LandingPagesGrid() {
  const variants = [...allVariants()]
    .filter((v) => v.generation === 0)
    .sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="grid w-full max-w-5xl grid-cols-3 gap-4">
        {variants.map((v) => (
          <PageTile key={v.id} variant={v} />
        ))}
      </div>
    </div>
  );
}

/** @deprecated */
export function LandingPagesSidebar({ compact }: { compact?: boolean }) {
  return <LandingPagesGrid />;
}
