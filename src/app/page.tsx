import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Capabilities } from "@/components/Capabilities";
import { Approach } from "@/components/Approach";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";
import { getCurrentProfile } from "@/lib/auth/profile";
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

export default async function Home() {
  const profile = await getCurrentProfile();

  return (
    <>
      <Header navLinks={navLinks} user={profile} />
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
