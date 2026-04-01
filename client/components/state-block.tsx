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
    <div className="surface rounded-[20px] border border-white/10 p-7">
      <p className="label-text">Status</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="button-primary mt-5">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
