import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Capabilities } from "@/components/Capabilities";
import { Approach } from "@/components/Approach";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";
import {
  navLinks,
  platformSection,
  capabilities,
  approachSteps,
  heroContent,
  approachContent,
  contactContent,
  footerTagline,
} from "@/lib/content-archive";

export const metadata: Metadata = {
  title: "M2MEC Archive",
  description: "Archived snapshot of the original M2MEC marketing site.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ArchivePage() {
  return (
    <>
      <Header navLinks={navLinks} homeHref="/archive-x" ctaLabel="Get in touch" showLogin={false} />
      <main>
        <Hero
          content={heroContent}
          capabilitiesHref="#capabilities"
          primaryCta="Start a conversation"
          secondaryCta="Explore capabilities"
        />
        <Capabilities
          id="capabilities"
          label={platformSection.label}
          title={platformSection.title}
          description={platformSection.description}
          items={capabilities}
          columns={3}
        />
        <Approach steps={approachSteps} content={approachContent} />
        <Contact content={contactContent} />
      </main>
      <Footer tagline={footerTagline} />
    </>
  );
}
