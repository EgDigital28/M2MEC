import { ImageResponse } from "next/og";
import { BODY_FAMILY, DISPLAY_FAMILY, loadFonts } from "@/lib/creative/fonts";
import {
  applyTransform,
  barcodeBars,
  resolveColor,
  type BrandKitVersion,
  type CreativeTemplate,
  type TemplateDecoration,
} from "@/lib/creative/types";

/**
 * Composes the finished creative.
 *
 * The backdrop is the only generated pixel; everything a reader acts on — the
 * odds, the units, the start time — is laid out here from real values. Layout
 * lives entirely in the template row, so retuning a design against a new
 * backdrop is a database edit rather than a deploy.
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
  const fonts = await loadFonts();
  const seed = JSON.stringify(values);

  function decoration(item: TemplateDecoration, index: number) {
    const color = resolveColor(item.colorRole, version);
    const box = {
      position: "absolute" as const,
      left: item.x * width,
      top: item.y * height,
      width: item.w * width,
      height: item.h * height,
    };

    if (item.type === "barcode") {
      return (
        <div
          key={`decoration-${index}`}
          style={{ ...box, display: "flex", alignItems: "flex-end", gap: 2 }}
        >
          {/* Grow rather than fixed widths, so the strip fills whatever box
              the template gives it at any canvas size. */}
          {barcodeBars(seed).map((bar, barIndex) => (
            <div
              key={barIndex}
              style={{ flexGrow: bar, height: "100%", backgroundColor: color }}
            />
          ))}
        </div>
      );
    }

    return (
      <div
        key={`decoration-${index}`}
        style={{
          ...box,
          display: "flex",
          backgroundColor: color,
          borderRadius: item.type === "rule" ? 0 : (item.radius ?? 12),
        }}
      />
    );
  }

  const response = new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          position: "relative",
          backgroundColor: version.secondary_color,
          fontFamily: BODY_FAMILY,
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

        {/* Before the text, so a chip sits behind its own labels. */}
        {(template.decorations ?? []).map(decoration)}

        {logoDataUrl && template.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoDataUrl}
            style={{
              position: "absolute",
              left: template.logo.x * width,
              top: template.logo.y * height,
              width: template.logo.w * width,
              height: template.logo.h * height,
              objectFit: "contain",
            }}
            alt=""
          />
        ) : null}

        {template.slots.map((slot) => {
          const raw = values[slot.key];
          if (!raw) return null;

          const left = slot.align === "center" ? slot.x - slot.w / 2 : slot.x;
          const size = slot.size * height;

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
                fontFamily: slot.font === "display" ? DISPLAY_FAMILY : BODY_FAMILY,
                // Anton ships one weight; asking for 900 would make Satori
                // fall back to a face it does have and lose the condensed cut.
                fontWeight: slot.font === "display" ? 400 : slot.weight,
                fontSize: size,
                // Satori reads every key present, so an explicit `undefined`
                // is not the same as an absent one — it throws.
                ...(slot.tracking ? { letterSpacing: slot.tracking * size } : {}),
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
    { width, height, fonts },
  );

  return Buffer.from(await response.arrayBuffer());
}
