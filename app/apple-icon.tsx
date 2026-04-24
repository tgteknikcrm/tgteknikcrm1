import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 92,
          background: "linear-gradient(135deg, #1e40af 0%, #0f172a 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 800,
          letterSpacing: "-0.06em",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        TG
      </div>
    ),
    size,
  );
}
