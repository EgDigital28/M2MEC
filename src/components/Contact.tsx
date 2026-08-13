export function Contact() {
  return (
    <section id="contact" className="border-t border-border bg-surface py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface-elevated to-surface">
          <div className="grid lg:grid-cols-2">
            <div className="p-8 md:p-12">
              <p className="text-sm font-medium uppercase tracking-widest text-accent">
                Contact
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Let&apos;s design your edge communication layer
              </h2>
              <p className="mt-4 text-muted leading-relaxed">
                Tell us about your devices, protocols, and latency requirements.
                We&apos;ll respond within one business day with next steps for a
                discovery call.
              </p>

              <dl className="mt-10 space-y-4">
                <div>
                  <dt className="text-sm text-muted">Email</dt>
                  <dd className="mt-1">
                    <a
                      href="mailto:hello@m2mec.io"
                      className="font-medium text-foreground transition-colors hover:text-accent"
                    >
                      hello@m2mec.io
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Focus areas</dt>
                  <dd className="mt-1 text-foreground">
                    Industrial IoT · OT/IT convergence · Edge gateways
                  </dd>
                </div>
              </dl>
            </div>

            <div className="border-t border-border bg-background/40 p-8 md:p-12 lg:border-t-0 lg:border-l">
              <form className="space-y-5" action="#" method="post">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
                    placeholder="Jane Smith"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium">
                    Work email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
                    placeholder="jane@company.com"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium">
                    Project overview
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    required
                    className="mt-2 w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
                    placeholder="Describe your edge topology, protocols, and goals..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-accent to-accent-secondary py-3.5 text-sm font-medium text-white shadow-lg shadow-accent/20 transition-opacity hover:opacity-90"
                >
                  Send message
                </button>

                <p className="text-center text-xs text-muted">
                  Form is for demo purposes. Wire to your backend or form service.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
