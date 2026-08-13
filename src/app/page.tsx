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
} from "@/lib/content";

export default function Home() {
  return (
    <>
      <Header navLinks={navLinks} />
      <main>
        <Hero content={heroContent} />
        <Capabilities
          label={platformSection.label}
          title={platformSection.title}
          description={platformSection.description}
          items={capabilities}
          columns={2}
        />
        <Approach steps={approachSteps} content={approachContent} />
        <Contact content={contactContent} />
      </main>
      <Footer tagline={footerTagline} />
    </>
  );
}
