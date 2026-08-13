function CapabilityIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    bridge: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
        <path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    signal: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
        <path d="M5 18h2M9 14h2M13 10h2M17 6h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M3 20h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    shield: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
        <path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    resilience: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
        <path d="M12 3a9 9 0 109 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    observe: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    fleet: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
        <rect x="3" y="8" width="7" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="14" y="5" width="7" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.5 12h0M17.5 11h0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  };

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
      {icons[type] ?? icons.bridge}
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 md:pt-40 md:pb-32">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute top-20 right-0 h-[300px] w-[400px] rounded-full bg-accent-secondary/8 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated/60 px-4 py-1.5 text-sm text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-secondary animate-pulse" />
            Machine-to-Machine Edge Communications
          </p>

          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl md:leading-[1.1]">
            Connect machines at the edge—{" "}
            <span className="bg-gradient-to-r from-accent to-accent-secondary bg-clip-text text-transparent">
              fast, secure, and resilient
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            M2MEC delivers low-latency, protocol-aware communication between
            industrial devices, gateways, and control systems—where milliseconds
            matter and the cloud is too far away.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#contact"
              className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-accent to-accent-secondary px-8 text-sm font-medium text-white shadow-lg shadow-accent/25 transition-opacity hover:opacity-90"
            >
              Start a conversation
            </a>
            <a
              href="#capabilities"
              className="inline-flex h-12 items-center justify-center rounded-full border border-border px-8 text-sm font-medium text-foreground transition-colors hover:bg-surface-elevated"
            >
              Explore capabilities
            </a>
          </div>
        </div>

        <div className="mx-auto mt-20 grid max-w-4xl grid-cols-3 gap-6 border-t border-border pt-10">
          {[
            { value: "<10ms", label: "Typical edge latency" },
            { value: "99.99%", label: "Uptime SLA targets" },
            { value: "50+", label: "Protocol adapters" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-mono text-2xl font-semibold text-foreground md:text-3xl">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { CapabilityIcon };
