import Link from "next/link";

export default function HomePage() {
  return (
    <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="surface relative overflow-hidden rounded-[32px] border border-white/10 p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <p className="label-text">Realtime civic reporting</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
          A black-theme civic network for reporting urgent problems and moving responders faster.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Citizens can sign in with Supabase, post issues anonymously, raise and comment on
          nearby reports, and help the most urgent local problems surface first. NGOs and
          government teams get a dedicated responder view with summaries and triage context.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/feed" className="button-primary">
            Open the feed
          </Link>
          <Link href="/register" className="button-secondary">
            Create an account
          </Link>
          <Link href="/institution" className="button-secondary">
            Institution dashboard
          </Link>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="surface-muted rounded-[24px] border border-white/10 p-5">
            <p className="label-text">Citizen tools</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Publish text-first issue reports, keep anonymity on by default, and add comments or raises.
            </p>
          </div>
          <div className="surface-muted rounded-[24px] border border-white/10 p-5">
            <p className="label-text">Ranking</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Feed ordering blends locality relevance, community engagement, and AI severity.
            </p>
          </div>
          <div className="surface-muted rounded-[24px] border border-white/10 p-5">
            <p className="label-text">Institution view</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Track unresolved issues, severity trends, and operational summaries in one place.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="surface rounded-[32px] border border-white/10 p-6">
          <p className="label-text">Included routes</p>
          <div className="mt-5 space-y-4">
            {[
              ["/login", "Supabase login with email or Google"],
              ["/register", "Anonymous registration flow"],
              ["/feed", "Ranked issue discovery feed"],
              ["/posts/new", "New civic issue composer"],
              ["/institution", "NGO and government summary view"],
            ].map(([path, description]) => (
              <div key={path} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="font-mono text-sm text-cyan-300">{path}</p>
                <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="surface rounded-[32px] border border-white/10 p-6">
          <p className="label-text">How this frontend behaves</p>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            <li>It uses your live Supabase project for authentication.</li>
            <li>It calls the backend API for feed, post, comment, raise, report, and summary data.</li>
            <li>When an endpoint is not implemented yet, the page shows a real error state instead of mock content.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
