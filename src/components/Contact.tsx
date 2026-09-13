import { WaitlistForm } from "@/components/WaitlistForm";

type ContactContent = {
  title: string;
  description: string;
  focusAreas: string;
  placeholder: string;
};

type ContactProps = {
  content: ContactContent;
};

export function Contact({ content }: ContactProps) {
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
                {content.title}
              </h2>
              <p className="mt-4 leading-relaxed text-muted">{content.description}</p>

              <dl className="mt-10 space-y-4">
                <div>
                  <dt className="text-sm text-muted">Email</dt>
                  <dd className="mt-1">
                    <a
                      href="mailto:hello@m2mec.com"
                      className="font-medium text-foreground transition-colors hover:text-accent"
                    >
                      hello@m2mec.com
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Focus areas</dt>
                  <dd className="mt-1 text-foreground">{content.focusAreas}</dd>
                </div>
              </dl>
            </div>

            <div className="border-t border-border bg-background/40 p-8 md:p-12 lg:border-t-0 lg:border-l">
              <WaitlistForm placeholder={content.placeholder} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
