import Link from "next/link";

export function StateBlock({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="surface rounded-[32px] border border-white/10 p-8">
      <p className="label-text">Status</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-8 text-slate-300">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="button-primary mt-6">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
