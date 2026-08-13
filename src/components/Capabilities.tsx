import { PlatformIcon } from "@/components/Hero";

type Capability = {
  title: string;
  description: string;
  icon: string;
};

type CapabilitiesProps = {
  id?: string;
  label: string;
  title: string;
  description: string;
  items: Capability[];
  columns?: 2 | 3;
};

export function Capabilities({
  id = "platform",
  label,
  title,
  description,
  items,
  columns = 2,
}: CapabilitiesProps) {
  const gridClass =
    columns === 3
      ? "sm:grid-cols-2 lg:grid-cols-3"
      : "sm:grid-cols-2";

  return (
    <section id={id} className="border-t border-border bg-surface py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            {label}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            {title}
          </h2>
          <p className="mt-4 text-muted">{description}</p>
        </div>

        <div className={`mt-16 grid gap-6 ${gridClass}`}>
          {items.map((cap) => (
            <article
              key={cap.title}
              className="group rounded-2xl border border-border bg-surface-elevated/50 p-6 transition-colors hover:border-accent/30 hover:bg-surface-elevated"
            >
              <PlatformIcon type={cap.icon} />
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
