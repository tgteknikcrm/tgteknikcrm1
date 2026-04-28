import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const revalidate = false;

// Maskable icon — Android adaptive launchers crop within a "safe zone"
// of ~80% of the image. We render the brand mark inside ~60% of the
// frame, with the gradient filling the entire 512x512 background.
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #1e40af 0%, #0f172a 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "60%",
            height: "60%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 220,
            fontWeight: 800,
            letterSpacing: "-0.08em",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          TG
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
