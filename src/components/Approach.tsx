import { approachSteps } from "@/lib/content";

export function Approach() {
  return (
    <section id="approach" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-accent-secondary">
              Our Approach
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              From assessment to fleet-scale deployment
            </h2>
            <p className="mt-4 text-muted leading-relaxed">
              We partner with engineering teams to design edge communication
              layers that fit existing infrastructure—not replace it. Every
              engagement follows a proven path from discovery to production.
            </p>

            <div className="mt-10 rounded-2xl border border-border bg-surface-elevated/50 p-6">
              <p className="text-sm font-medium text-foreground">
                Typical engagement timeline
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                  <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-accent to-accent-secondary" />
                </div>
                <span className="font-mono text-sm text-muted">8–16 weeks</span>
              </div>
              <p className="mt-3 text-sm text-muted">
                Pilot to production, depending on fleet size and protocol complexity.
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="absolute left-4 top-0 hidden h-full w-px bg-border lg:block" />

            <ol className="space-y-8">
              {approachSteps.map((step, index) => (
                <li key={step.step} className="relative flex gap-6">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-background font-mono text-xs font-semibold text-accent">
                    {step.step}
                  </div>

                  <div className="flex-1 rounded-2xl border border-border bg-surface-elevated/30 p-6 transition-colors hover:border-accent/20 hover:bg-surface-elevated/60">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-lg font-semibold">{step.title}</h3>
                      <span className="hidden font-mono text-xs text-muted sm:inline">
                        Phase {index + 1}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
