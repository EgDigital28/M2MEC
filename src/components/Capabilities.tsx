import { capabilities } from "@/lib/content";
import { CapabilityIcon } from "@/components/Hero";

export function Capabilities() {
  return (
    <section id="capabilities" className="border-t border-border bg-surface py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            Capabilities
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Built for industrial-grade M2M at the edge
          </h2>
          <p className="mt-4 text-muted">
            From protocol translation to fleet-wide orchestration, M2MEC
            provides the primitives your distributed systems need to communicate
            reliably.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((cap) => (
            <article
              key={cap.title}
              className="group rounded-2xl border border-border bg-surface-elevated/50 p-6 transition-colors hover:border-accent/30 hover:bg-surface-elevated"
            >
              <CapabilityIcon type={cap.icon} />
              <h3 className="mt-4 text-lg font-semibold">{cap.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {cap.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
