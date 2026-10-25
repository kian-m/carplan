import { ImageResponse } from "next/og";

export const alt = "CarPlan: what's your car's next move?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#fff", padding: 80, borderTop: "16px solid #eb0a1e" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, fontSize: 44, fontWeight: 700 }}>
          <span style={{ display: "flex" }}>
            Car<span style={{ color: "#eb0a1e" }}>Plan</span>
          </span>
          <span style={{ fontSize: 26, fontWeight: 400, color: "#58595b" }}>for Toyota Financial Services</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>What&rsquo;s your car&rsquo;s next move?</div>
          <div style={{ fontSize: 34, color: "#58595b" }}>Snap your contract. See every option side by side, with honest math.</div>
        </div>
        <div style={{ fontSize: 28, color: "#58595b" }}>carplan.tech</div>
      </div>
    ),
    size,
  );
}
