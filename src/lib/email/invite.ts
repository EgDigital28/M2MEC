import {
  renderEmailButton,
  renderEmailDisclaimer,
  renderEmailParagraph,
  renderEmailSection,
  renderEmailShell,
} from "@/lib/email/layout";
import { TIER_DESCRIPTIONS, TIER_LABELS, type UserTier } from "@/lib/tiers";

type InviteEmailParams = {
  tier: UserTier;
  actionLink: string;
};

type InviteCopy = {
  subject: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  paragraphs: string[];
  buttonLabel?: string;
  disclaimer: string;
};

const INVESTOR_INVITE_DISCLAIMER =
  "NOTICE: This transmission contains strictly confidential information intended solely for the designated recipient. Unauthorized review, use, disclosure, copying, or forwarding of this communication—including any registration links or invitation tokens contained herein—is strictly prohibited. If you are not the intended recipient, please immediately delete this message and notify the sender.";

const GENERAL_INVITE_DISCLAIMER =
  "Confidentiality Notice: This email and any files transmitted with it are confidential and intended solely for the use of the individual or entity to whom they are addressed. If you are not the named addressee, you should not disseminate, distribute, copy, or forward this email. Please notify the sender immediately if you have received this email by mistake and delete it from your system.";

function getInviteDisclaimer(tier: UserTier) {
  return tier === "investor" ? INVESTOR_INVITE_DISCLAIMER : GENERAL_INVITE_DISCLAIMER;
}

function getInviteCopy(tier: UserTier): InviteCopy {
  const disclaimer = getInviteDisclaimer(tier);

  if (tier === "employee") {
    return {
      subject: "Welcome to the M2MEC team",
      eyebrow: "Team invite",
      title: "Welcome to the team!",
      subtitle: "You've been invited as an internal team member.",
      paragraphs: [
        "Set your password to access the team workspace — bet ledger, internal tools, and everything we're building together.",
        "This invite is for <strong style=\"color:#e8edf5;\">Employee</strong> access (internal team tools).",
      ],
      disclaimer,
    };
  }

  if (tier === "a") {
    return {
      subject: "Your M2MEC access is ready",
      eyebrow: "Account invite",
      title: "Welcome to M2MEC",
      subtitle: `You've been invited with ${TIER_LABELS.a} access.`,
      paragraphs: [
        `${TIER_DESCRIPTIONS.a}. Set your password to sign in and start using the platform.`,
        "This invite is for <strong style=\"color:#e8edf5;\">Tier A</strong> access only. Each email address can be tied to one access tier.",
      ],
      disclaimer,
    };
  }

  if (tier === "investor") {
    return {
      subject: "Welcome to the M2MEC team",
      eyebrow: "Investor invite",
      title: "Welcome to the team!",
      subtitle: "You've been invited as an M2MEC investor.",
      paragraphs: [
        "We're glad to have you. Complete your registration to set a password, add your name, and sign in to the platform.",
        `${TIER_DESCRIPTIONS.investor}. This invite is for <strong style="color:#e8edf5;">Investor</strong> access only.`,
      ],
      buttonLabel: "Complete registration",
      disclaimer,
    };
  }

  if (tier === "b") {
    return {
      subject: "Your M2MEC access is ready",
      eyebrow: "Account invite",
      title: "Welcome to M2MEC",
      subtitle: `You've been invited with ${TIER_LABELS.b} access.`,
      paragraphs: [
        `${TIER_DESCRIPTIONS.b}. Set your password to sign in and explore what's available to you.`,
        "This invite is for <strong style=\"color:#e8edf5;\">Tier B</strong> access only. Each email address can be tied to one access tier.",
      ],
      disclaimer,
    };
  }

  return {
    subject: "Your M2MEC access is ready",
    eyebrow: "Account invite",
    title: "Welcome to M2MEC",
    subtitle: "You've been invited to M2MEC.",
    paragraphs: [
      "Set your password to sign in.",
      "Each email address can be tied to one access tier.",
    ],
    disclaimer,
  };
}

export function inviteEmailSubject({ tier }: Pick<InviteEmailParams, "tier">) {
  return getInviteCopy(tier).subject;
}

export function inviteEmailHtml({ tier, actionLink }: InviteEmailParams) {
  const copy = getInviteCopy(tier);

  return renderEmailShell(`
    ${renderEmailSection({
      eyebrow: copy.eyebrow,
      title: copy.title,
      subtitle: copy.subtitle,
    })}
    ${copy.paragraphs.map((paragraph) => renderEmailParagraph(paragraph)).join("")}
    ${renderEmailButton(actionLink, copy.buttonLabel ?? "Complete registration")}
    ${renderEmailParagraph("If you weren't expecting this invite, you can ignore this email.")}
    ${renderEmailDisclaimer(copy.disclaimer)}
  `);
}

export function inviteEmailText({ tier, actionLink }: InviteEmailParams) {
  const copy = getInviteCopy(tier);

  return `
${copy.title}

${copy.subtitle}

${copy.paragraphs.map((paragraph) => paragraph.replace(/<[^>]+>/g, "")).join("\n\n")}

${copy.buttonLabel ?? "Complete registration"}: ${actionLink}

If you weren't expecting this invite, you can ignore this email.

${copy.disclaimer}

— M2MEC
  `.trim();
}
