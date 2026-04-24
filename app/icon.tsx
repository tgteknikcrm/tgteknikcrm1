import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 260,
          background: "linear-gradient(135deg, #1e40af 0%, #0f172a 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 800,
          letterSpacing: "-0.08em",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        TG
      </div>
    ),
    size,
  );
}
