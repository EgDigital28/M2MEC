import { ImageResponse } from "next/og";
import {
  applyTransform,
  resolveColor,
  type BrandKitVersion,
  type CreativeTemplate,
} from "@/lib/creative/types";

/**
 * Composes the finished creative.
 *
 * The backdrop is the only generated pixel; everything a reader acts on — the
 * odds, the units, the start time — is laid out here from real values. Uses
 * next/og, which bundles Satori, resvg and a font, so there is no font file to
 * ship and nothing for the bundler to miss.
 */
export async function composeCreative({
  template,
  version,
  values,
  backdropDataUrl,
  logoDataUrl,
}: {
  template: CreativeTemplate;
  version: BrandKitVersion;
  values: Record<string, string>;
  backdropDataUrl: string | null;
  logoDataUrl: string | null;
}) {
  const { width, height } = template;
  const accentSlots = new Set(["unitsLabel", "units", "unitsSuffix"]);
  const hasAccentBlock = template.slots.some((slot) => accentSlots.has(slot.key));

  const response = new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          position: "relative",
          backgroundColor: version.secondary_color,
        }}
      >
        {backdropDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdropDataUrl}
            width={width}
            height={height}
            style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }}
            alt=""
          />
        ) : null}

        {/* Drawn before the text so the accent block sits behind its labels. */}
        {hasAccentBlock ? (
          <div
            style={{
              position: "absolute",
              left: width * 0.635,
              top: height * 0.385,
              width: width * 0.2,
              height: height * 0.15,
              backgroundColor: version.accent_color,
              borderRadius: 12,
              display: "flex",
            }}
          />
        ) : null}

        {logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoDataUrl}
            style={{
              position: "absolute",
              left: width * 0.3,
              top: height * 0.035,
              width: width * 0.4,
              height: height * 0.13,
              objectFit: "contain",
            }}
            alt=""
          />
        ) : null}

        {template.slots.map((slot) => {
          const raw = values[slot.key];
          if (!raw) return null;

          const left = slot.align === "center" ? slot.x - slot.w / 2 : slot.x;

          return (
            <div
              key={slot.key}
              style={{
                position: "absolute",
                left: left * width,
                top: slot.y * height,
                width: slot.w * width,
                display: "flex",
                justifyContent:
                  slot.align === "center"
                    ? "center"
                    : slot.align === "right"
                      ? "flex-end"
                      : "flex-start",
                textAlign: slot.align,
                fontSize: slot.size * height,
                fontWeight: slot.weight,
                lineHeight: 1.1,
                color: resolveColor(slot.colorRole, version),
              }}
            >
              {applyTransform(raw, slot.transform)}
            </div>
          );
        })}
      </div>
    ),
    { width, height },
  );

  return Buffer.from(await response.arrayBuffer());
}
