import React, { useState, useEffect, useRef, useMemo } from "react";

// ============================================================
// Adaptive AR Cockpit Overlay — Master's Thesis Prototype
// v3: clipped windshield, deep taxi perspective, 15s takeoff
// cinematic, emergency recovery to normal sky.
// ============================================================

const DESIGN_W = 1600;
const DESIGN_H = 900;
const COCKPIT_H = 0.38;                  // 38% of canvas
const WINDSHIELD_H = 1 - COCKPIT_H;        // sky stops exactly at cockpit top — no overlap
const WINDSHIELD_PX = Math.round(DESIGN_H * WINDSHIELD_H);

const COLORS = {
  green: "#00FF44",
  cyan: "#00E5FF",
  magenta: "#FF55FF",
  amber: "#FFA500",
  red: "#FF3333",
  recovered: "#00FF88",
  label: "rgba(255,255,255,0.45)",
};

const TEXT_SHADOW = "0 0 4px rgba(0,0,0,0.7), 0 0 8px rgba(0,0,0,0.5)";
const SVG_FILTER =
  "drop-shadow(0 0 3px rgba(0,0,0,0.8)) drop-shadow(0 0 6px rgba(0,0,0,0.5))";

const txt = (color, size, opacity = 1, bold = false, spacing = 0) => ({
  color,
  fontSize: size + "px",
  fontWeight: bold ? 700 : 400,
  letterSpacing: spacing + "px",
  opacity,
  textShadow: TEXT_SHADOW,
  fontFamily: '"Roboto Mono", ui-monospace, monospace',
  lineHeight: 1.2,
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pad = (n, w) => String(Math.max(0, Math.round(n))).padStart(w, "0");
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// ============================================================
// SKY + HORIZON LAYER
// ============================================================
const SkyHorizon = ({ bank, pitch, skyTop, skyMid, ground, horizonY = 0.5 }) => (
  <div
    style={{
      position: "absolute",
      inset: "-25%",
      transform: "translateY(" + pitch + "px) rotate(" + bank + "deg)",
      transformOrigin: "50% 55%",
      transition: "transform 80ms linear",
      pointerEvents: "none",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: horizonY * 100 + "%",
        background:
          "linear-gradient(180deg, " + skyTop + " 0%, " + skyMid + " 100%)",
        transition: "background 1200ms ease-in-out",
      }}
    />
    <div
      style={{
        position: "absolute",
        top: horizonY * 100 + "%",
        left: 0,
        right: 0,
        bottom: 0,
        background: ground,
        transition: "background 1200ms ease-in-out",
      }}
    />
    <div
      style={{
        position: "absolute",
        top: "calc(" + horizonY * 100 + "% - 1px)",
        left: 0,
        right: 0,
        height: 2,
        background: "rgba(140,170,200,0.35)",
        boxShadow: "0 0 12px rgba(140,170,200,0.25)",
      }}
    />
  </div>
);

const Clouds = ({ speed = 70, opacity = 0.3, topRange = [5, 45] }) => {
  // Blobs are generated ONCE — never regenerated when `speed` changes,
  // otherwise they teleport every frame (caused the takeoff "spin" feel).
  // Each blob carries a stable fraction (0..1) of the cycle as its delay.
  const [topMin, topMax] = topRange;
  const blobs = useMemo(
    () =>
      [...Array(7)].map(() => ({
        top: topMin + Math.random() * (topMax - topMin),
        size: 90 + Math.random() * 140,
        delayFrac: Math.random(),
        op: 0.4 + Math.random() * 0.6,
      })),
    [topMin, topMax]
  );
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        opacity,
        pointerEvents: "none",
        transition: "opacity 600ms ease-out",
      }}
    >
      {blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: b.top + "%",
            left: "-30%",
            width: b.size * 2.4,
            height: b.size * 0.7,
            background:
              "radial-gradient(ellipse at center, rgba(220,230,245," +
              b.op +
              ") 0%, rgba(220,230,245,0) 70%)",
            animation: "cloudDrift " + speed + "s linear infinite",
            animationDelay: -(b.delayFrac * speed) + "s",
            filter: "blur(6px)",
          }}
        />
      ))}
    </div>
  );
};

// ============================================================
// TAXI BACKGROUND — deep horizon, long runway perspective
// White runway style consistent with TAKEOFF.
// ============================================================
const TaxiwayBackground = ({ bank, pitch }) => {
  // horizon set high → runway stretches far below
  const horizonPx = 110; // ~20% from top within windshield
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <SkyHorizon
        bank={bank * 0.25}
        pitch={pitch * 0.25}
        skyTop="#10243a"
        skyMid="#3b5878"
        ground="linear-gradient(180deg, #2a2618 0%, #1a1610 60%, #080604 100%)"
        horizonY={horizonPx / WINDSHIELD_PX}
      />
      {/* Far hills hint */}
      <svg
        viewBox={"0 0 " + DESIGN_W + " " + WINDSHIELD_PX}
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <path
          d={
            "M 0 " +
            (horizonPx - 4) +
            " Q 400 " +
            (horizonPx - 22) +
            " 800 " +
            (horizonPx - 8) +
            " T 1600 " +
            (horizonPx - 6) +
            " L 1600 " +
            (horizonPx + 4) +
            " L 0 " +
            (horizonPx + 4) +
            " Z"
          }
          fill="#1c2a28"
          opacity="0.55"
        />
        <defs>
          <linearGradient id="taxiRwyFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        {/* Paved area (matches takeoff dark grey) */}
        <polygon
          points={
            "780," + (horizonPx + 2) +
            " 820," + (horizonPx + 2) +
            " 1100," + WINDSHIELD_PX +
            " 500," + WINDSHIELD_PX
          }
          fill="#0e0e0c"
          opacity="0.85"
        />
        {/* White edge fade — narrow inner edges (like takeoff) */}
        <polygon
          points={
            "795," + (horizonPx + 2) +
            " 805," + (horizonPx + 2) +
            " 880," + WINDSHIELD_PX +
            " 720," + WINDSHIELD_PX
          }
          fill="url(#taxiRwyFade)"
        />
      </svg>
      {/* Animated white centerline dashes — mask fades them in from the horizon
          so they appear continuously instead of cutting off abruptly */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: horizonPx + "px",
          height: WINDSHIELD_PX - horizonPx + "px",
          width: 26,
          transform: "translateX(-50%) perspective(420px) rotateX(74deg)",
          transformOrigin: "top center",
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.95) 0, rgba(255,255,255,0.95) 50px, transparent 50px, transparent 110px)",
          animation: "taxiScroll 2.8s linear infinite",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 8%, #000 35%, #000 100%)",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 8%, #000 35%, #000 100%)",
        }}
      />
    </div>
  );
};

// ============================================================
// TAKEOFF BACKGROUND — driven by progress (0→1) over 15s
// ============================================================
const TakeoffBackground = ({ bank, pitch, progress }) => {
  // Phases inside takeoff
  // 0.00–0.30  ground roll          (runway full, camera level)
  // 0.30–0.45  rotation              (nose pitches up slightly)
  // 0.45–1.00  initial climb         (runway slides down out of view)
  const rot = clamp((progress - 0.3) / 0.15, 0, 1);
  const climb = clamp((progress - 0.45) / 0.55, 0, 1);

  // Horizon stays put on the ground, then drops out of view as we climb
  const baseHorizon = 0.62;
  const horizonY = baseHorizon + easeInOut(climb) * 0.55;
  const horizonPx = Math.round(horizonY * WINDSHIELD_PX);

  // Runway anchors to the horizon — never extends into the sky.
  // As the horizon drops, the runway drops with it (then fades out).
  const runwayTopPx = horizonPx;
  const runwayOp = clamp(1 - climb * 1.4, 0, 1);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <SkyHorizon
        bank={bank}
        pitch={pitch - rot * 30}
        skyTop="#0a1a30"
        skyMid="#3a5a80"
        ground="linear-gradient(180deg, #1a2018 0%, #0a0d08 100%)"
        horizonY={horizonY}
      />
      {/* Constant cloud speed — changing the CSS animation duration mid-flight
          resets each cloud's position and looks like a sudden roll/spin. */}
      <Clouds speed={55} opacity={lerp(0.12, 0.32, climb)} topRange={[3, 35]} />
      {/* Runway (only ever drawn on/below the horizon) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: runwayOp,
          transition: "opacity 200ms linear",
        }}
      >
        <svg
          viewBox={"0 0 " + DESIGN_W + " " + WINDSHIELD_PX}
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
          }}
        >
          <defs>
            <linearGradient id="rwyFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.85" />
            </linearGradient>
          </defs>
          <polygon
            points={
              "790," + runwayTopPx +
              " 810," + runwayTopPx +
              " 1100," + WINDSHIELD_PX +
              " 500," + WINDSHIELD_PX
            }
            fill="#0e0e0c"
            opacity="0.85"
          />
          <polygon
            points={
              "795," + runwayTopPx +
              " 805," + runwayTopPx +
              " 880," + WINDSHIELD_PX +
              " 720," + WINDSHIELD_PX
            }
            fill="url(#rwyFade)"
          />
        </svg>
        {/* Centerline dashes — fixed scroll duration; faster feel comes from
            the visible perspective compression, not from changing animation length. */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: runwayTopPx + "px",
            height: Math.max(0, WINDSHIELD_PX - runwayTopPx) + "px",
            width: 26,
            transform: "translateX(-50%) perspective(380px) rotateX(74deg)",
            transformOrigin: "top center",
            background:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.95) 0, rgba(255,255,255,0.95) 50px, transparent 50px, transparent 110px)",
            animation: "rwyScroll 0.7s linear infinite",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 8%, #000 35%, #000 100%)",
            maskImage:
              "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 8%, #000 35%, #000 100%)",
          }}
        />
      </div>
    </div>
  );
};

// ============================================================
// CRUISE BACKGROUND
// ============================================================
const CruiseBackground = ({ bank, pitch }) => (
  <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
    <SkyHorizon
      bank={bank}
      pitch={pitch}
      skyTop="#0e2240"
      skyMid="#3d6088"
      ground="linear-gradient(180deg, #1a221a 0%, #0a0e0a 100%)"
      horizonY={0.78}
    />
    <Clouds speed={85} opacity={0.5} topRange={[5, 55]} />
  </div>
);

// ============================================================
// APPROACH BACKGROUND
// ============================================================
const ApproachBackground = ({ bank, pitch }) => (
  <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
    <SkyHorizon
      bank={bank}
      pitch={pitch}
      skyTop="#0a1828"
      skyMid="#345070"
      ground="linear-gradient(180deg, #1f2418 0%, #0c0e08 100%)"
      horizonY={0.66}
    />
    <Clouds speed={70} opacity={0.22} topRange={[3, 35]} />
    {/* distant runway */}
    <svg
      viewBox={"0 0 " + DESIGN_W + " " + WINDSHIELD_PX}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0.65,
      }}
    >
      <defs>
        <linearGradient id="appRwy" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#aac" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#cce" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <polygon
        points={
          "785," + Math.round(WINDSHIELD_PX * 0.66 + 4) +
          " 815," + Math.round(WINDSHIELD_PX * 0.66 + 4) +
          " 880," + (WINDSHIELD_PX - 30) +
          " 720," + (WINDSHIELD_PX - 30)
        }
        fill="url(#appRwy)"
      />
      <circle cx="755" cy={Math.round(WINDSHIELD_PX * 0.66 + 10)} r="2.5" fill="#FF3333" />
      <circle cx="775" cy={Math.round(WINDSHIELD_PX * 0.66 + 10)} r="2.5" fill="#FF3333" />
      <circle cx="825" cy={Math.round(WINDSHIELD_PX * 0.66 + 10)} r="2.5" fill="#ffffff" />
      <circle cx="845" cy={Math.round(WINDSHIELD_PX * 0.66 + 10)} r="2.5" fill="#ffffff" />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle
          key={i}
          cx={800}
          cy={Math.round(WINDSHIELD_PX * 0.66 + 25 + i * 30)}
          r="2"
          fill="#fff"
          opacity={0.4 + i * 0.12}
        />
      ))}
    </svg>
  </div>
);

// ============================================================
// EMERGENCY BACKGROUND (+ recovery)
// ============================================================
const EmergencyBackground = ({ bank, pitch, variant, recovered }) => {
  // Recovered → calm blue sky like cruise
  const skyTop = recovered
    ? "#0e2240"
    : variant === "engine"
    ? "#2a0a08"
    : "#2a2008";
  const skyMid = recovered
    ? "#3d6088"
    : variant === "engine"
    ? "#603020"
    : "#604020";
  const ground = recovered
    ? "linear-gradient(180deg, #1a221a 0%, #0a0e0a 100%)"
    : variant === "engine"
    ? "linear-gradient(180deg, #281a14 0%, #0e0805 100%)"
    : "linear-gradient(180deg, #221a14 0%, #0a0805 100%)";
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <SkyHorizon
        bank={bank}
        pitch={pitch + (recovered ? 0 : 20)}
        skyTop={skyTop}
        skyMid={skyMid}
        ground={ground}
        horizonY={recovered ? 0.78 : 0.6}
      />
      {recovered && <Clouds speed={85} opacity={0.45} topRange={[5, 55]} />}
      {/* tinted vignette while in failure state */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            variant === "engine"
              ? "radial-gradient(ellipse at center, rgba(255,40,40,0) 40%, rgba(80,0,0,0.35) 100%)"
              : "radial-gradient(ellipse at center, rgba(255,160,40,0) 40%, rgba(80,40,0,0.30) 100%)",
          opacity: recovered ? 0 : 1,
          transition: "opacity 1200ms ease-out",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

const PhaseBackground = ({ phase, bank, pitch, variant, recovered, takeoffProgress }) => {
  if (phase === "taxi") return <TaxiwayBackground bank={bank} pitch={pitch} />;
  if (phase === "takeoff")
    return <TakeoffBackground bank={bank} pitch={pitch} progress={takeoffProgress} />;
  if (phase === "cruise") return <CruiseBackground bank={bank} pitch={pitch} />;
  if (phase === "approach") return <ApproachBackground bank={bank} pitch={pitch} />;
  if (phase === "emergency")
    return (
      <EmergencyBackground
        bank={bank}
        pitch={pitch}
        variant={variant}
        recovered={recovered}
      />
    );
  return null;
};

// ============================================================
// COCKPIT SILHOUETTE
// ============================================================
const Cockpit = () => (
  <svg
    viewBox="0 0 1600 560"
    preserveAspectRatio="xMidYMax slice"
    style={{
      position: "absolute",
      bottom: 0,
      left: 0,
      width: "100%",
      height: COCKPIT_H * 100 + "%",
      pointerEvents: "none",
      zIndex: 5,
    }}
  >
    <path
      d="M 0,80 Q 800,0 1600,80 L 1600,560 L 0,560 Z"
      fill="#0a0d10"
      stroke="#1a1f25"
      strokeWidth="2"
    />
    <rect x="200" y="100" width="1200" height="380" fill="#0d1216" stroke="#1a2128" strokeWidth="2" rx="8" />
    {[[380, 200], [520, 200], [660, 200], [380, 340], [520, 340], [660, 340]].map(([cx, cy], i) => (
      <g key={i}>
        <circle cx={cx} cy={cy} r="58" fill="#05080a" stroke="#252d34" strokeWidth="2.5" />
        <circle cx={cx} cy={cy} r="48" fill="none" stroke="#1a2026" strokeWidth="1" />
        {[...Array(12)].map((_, t) => {
          const a = (t * Math.PI * 2) / 12;
          return (
            <line
              key={t}
              x1={cx + Math.cos(a) * 46}
              y1={cy + Math.sin(a) * 46}
              x2={cx + Math.cos(a) * 52}
              y2={cy + Math.sin(a) * 52}
              stroke="#2a3138"
              strokeWidth="1"
            />
          );
        })}
        <line x1={cx} y1={cy} x2={cx + 18} y2={cy - 22} stroke="#3a4148" strokeWidth="2" />
        <circle cx={cx} cy={cy} r="3" fill="#3a4148" />
      </g>
    ))}
    <rect x="820" y="150" width="240" height="280" fill="#070a0c" stroke="#1f262c" strokeWidth="2" rx="4" />
    {[0, 1, 2, 3, 4].map((i) => (
      <g key={i}>
        <rect x="840" y={170 + i * 50} width="200" height="36" fill="#0a0f13" stroke="#1a2026" strokeWidth="1" rx="2" />
        <rect x="850" y={180 + i * 50} width="80" height="16" fill="#1a1d10" rx="1" />
        <circle cx="1010" cy={188 + i * 50} r="8" fill="#1a2026" stroke="#252d34" strokeWidth="1" />
      </g>
    ))}
    <g>
      <rect x="700" y="430" width="20" height="110" fill="#0a0d10" stroke="#1f262c" strokeWidth="1.5" />
      <path d="M 580,470 Q 720,440 860,470 L 860,510 Q 720,485 580,510 Z" fill="#0a0d10" stroke="#1f262c" strokeWidth="2" />
      <circle cx="720" cy="490" r="12" fill="#0d1216" stroke="#252d34" strokeWidth="1.5" />
    </g>
    <rect x="1120" y="180" width="220" height="220" fill="#070a0c" stroke="#1f262c" strokeWidth="2" rx="4" />
    {[...Array(4)].map((_, r) =>
      [...Array(3)].map((_, c) => (
        <g key={r + "-" + c}>
          <rect x={1140 + c * 65} y={200 + r * 50} width="45" height="30" fill="#0a0f13" stroke="#1a2026" strokeWidth="1" rx="2" />
          <rect x={1155 + c * 65} y={208 + r * 50} width="15" height="14" fill="#1a2026" />
        </g>
      ))
    )}
  </svg>
);

// ============================================================
// AR PRIMITIVES
// ============================================================

const Fade = ({ visible, opacity = 1, duration = 800, children, style = {} }) => (
  <div
    style={{
      ...style,
      opacity: visible ? opacity : 0,
      transition: "opacity " + duration + "ms ease-in-out",
      pointerEvents: visible ? "auto" : "none",
    }}
  >
    {children}
  </div>
);

const AirspeedTape = ({ value, vrefMark, vyMark, trend }) => {
  const center = Math.round(value / 10) * 10;
  const ticks = [40, 30, 20, 10, 0, -10, -20, -30, -40].map((d) => center - d);
  return (
    <div style={{ position: "relative", width: 130, height: 240 }}>
      <div style={{ ...txt(COLORS.label, 13, 1, true, 1), position: "absolute", top: -22, left: 0 }}>IAS</div>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(0,255,68,0.15)", borderRadius: 4, overflow: "hidden" }} />
      {ticks.map((v, i) => (
        <div key={i} style={{ ...txt(COLORS.green, 12, 0.35), position: "absolute", right: 12, top: i * 26 + 12 }}>{v}</div>
      ))}
      {ticks.map((v, i) => (
        <div key={"t" + i} style={{ position: "absolute", right: 0, top: i * 26 + 18, width: 6, height: 1, background: COLORS.green, opacity: 0.35 }} />
      ))}
      {vrefMark && (
        <>
          <div style={{ position: "absolute", left: -4, right: 0, top: 175, height: 2, background: COLORS.cyan }} />
          <div style={{ ...txt(COLORS.cyan, 14, 1, true), position: "absolute", left: -58, top: 166 }}>{vrefMark}</div>
        </>
      )}
      {vyMark && (
        <>
          <div style={{ position: "absolute", left: -4, right: 0, top: 60, height: 2, background: COLORS.magenta }} />
          <div style={{ ...txt(COLORS.magenta, 14, 1, true), position: "absolute", left: -58, top: 51 }}>{vyMark}</div>
        </>
      )}
      <div style={{ position: "absolute", left: -6, right: -6, top: 100, height: 44, border: "1.5px solid " + COLORS.green, background: "rgba(0,0,0,0.65)", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: TEXT_SHADOW }}>
        <span style={{ ...txt(COLORS.green, 30, 1, true) }}>{Math.round(value)}</span>
      </div>
      {trend !== 0 && (
        <div style={{ position: "absolute", left: "50%", top: trend > 0 ? 70 : null, bottom: trend < 0 ? 70 : null, transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderBottom: trend > 0 ? "12px solid " + COLORS.green : "none", borderTop: trend < 0 ? "12px solid " + COLORS.green : "none", opacity: 0.7, filter: SVG_FILTER }} />
      )}
    </div>
  );
};

const AltitudeTape = ({ value }) => {
  const center = Math.round(value / 100) * 100;
  const ticks = [400, 300, 200, 100, 0, -100, -200, -300, -400].map((d) => center - d);
  return (
    <div style={{ position: "relative", width: 130, height: 240 }}>
      <div style={{ ...txt(COLORS.label, 13, 1, true, 1), position: "absolute", top: -22, right: 0 }}>ALT</div>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(0,255,68,0.15)", borderRadius: 4 }} />
      {ticks.map((v, i) => (
        <div key={i} style={{ ...txt(COLORS.green, 12, 0.35), position: "absolute", left: 10, top: i * 26 + 12 }}>{v}</div>
      ))}
      {ticks.map((v, i) => (
        <div key={"t" + i} style={{ position: "absolute", left: 0, top: i * 26 + 18, width: 6, height: 1, background: COLORS.green, opacity: 0.35 }} />
      ))}
      <div style={{ position: "absolute", left: -6, right: -6, top: 100, height: 44, border: "1.5px solid " + COLORS.green, background: "rgba(0,0,0,0.65)", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: TEXT_SHADOW }}>
        <span style={{ ...txt(COLORS.green, 28, 1, true) }}>{Math.round(value)}</span>
      </div>
      <div style={{ ...txt(COLORS.green, 11, 0.5), position: "absolute", right: -4, bottom: -20 }}>FT</div>
    </div>
  );
};

const Attitude = ({ opacity = 0.92, thick = false, withFPV = false, bank = 0, pitch = 0 }) => {
  const stroke = thick ? 4 : 3;
  return (
    <svg viewBox="-300 -180 600 360" style={{ width: 600, height: 360, opacity, transition: "opacity 800ms ease-in-out", overflow: "visible", filter: SVG_FILTER }}>
      <g transform={"rotate(" + -bank + ") translate(0," + pitch + ")"} style={{ transition: "transform 80ms linear" }}>
        <polygon points="0,-160 -8,-148 8,-148" fill={COLORS.green} opacity="0.3" />
        {[-60, -30, -10, 10, 30, 60].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const r1 = 150;
          const r2 = Math.abs(deg) > 30 ? 162 : 158;
          return (
            <line key={deg} x1={Math.sin(rad) * r1} y1={-Math.cos(rad) * r1} x2={Math.sin(rad) * r2} y2={-Math.cos(rad) * r2} stroke={COLORS.green} strokeWidth="1.5" opacity={Math.abs(deg) > 30 ? 0.15 : 0.25} />
          );
        })}
        <line x1="-260" y1="0" x2="-90" y2="0" stroke={COLORS.green} strokeWidth={thick ? 4 : 3} />
        <line x1="-90" y1="0" x2="90" y2="0" stroke={COLORS.green} strokeWidth="1" />
        <line x1="90" y1="0" x2="260" y2="0" stroke={COLORS.green} strokeWidth={thick ? 4 : 3} />
        {[{ y: -60, label: "10", op: 0.3 }, { y: -30, label: "5", op: 0.25 }, { y: 30, label: "-5", op: 0.25 }, { y: 60, label: "-10", op: 0.3 }].map(({ y, label, op }) => (
          <g key={y}>
            <line x1="-40" y1={y} x2="40" y2={y} stroke={COLORS.green} strokeWidth="1.5" opacity={op} />
            <text x="-58" y={y + 4} fontSize="11" fill={COLORS.green} opacity={op} fontFamily='"Roboto Mono", monospace'>{label}</text>
            <text x="48" y={y + 4} fontSize="11" fill={COLORS.green} opacity={op} fontFamily='"Roboto Mono", monospace'>{label}</text>
          </g>
        ))}
      </g>
      <polyline points="-70,0 -40,0 -20,18 0,4 20,18 40,0 70,0" fill="none" stroke={COLORS.green} strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="0" cy="4" r="2.5" fill={COLORS.green} />
      {withFPV && (
        <g transform={"translate(" + -bank * 1.5 + ", " + (pitch * 0.6 + 25) + ")"} opacity="0.95" style={{ transition: "transform 80ms linear" }}>
          <circle cx="0" cy="0" r="11" fill="none" stroke={COLORS.green} strokeWidth="2.5" />
          <line x1="-22" y1="0" x2="-11" y2="0" stroke={COLORS.green} strokeWidth="2.5" />
          <line x1="11" y1="0" x2="22" y2="0" stroke={COLORS.green} strokeWidth="2.5" />
          <line x1="0" y1="-11" x2="0" y2="-20" stroke={COLORS.green} strokeWidth="2.5" />
        </g>
      )}
    </svg>
  );
};

const HeadingTape = ({ heading, opacity = 1 }) => {
  const visible = [];
  for (let d = -30; d <= 30; d += 10) {
    const h = (((Math.round(heading / 10) * 10 + d) % 360) + 360) % 360;
    const offset = ((heading - (Math.round(heading / 10) * 10 + d)) / 10) * 60;
    visible.push({ h, x: 190 + d * 6 - offset });
  }
  return (
    <div style={{ position: "relative", width: 380, opacity, transition: "opacity 800ms ease-in-out" }}>
      <div style={{ ...txt(COLORS.label, 13, 1, true, 1), textAlign: "center", marginBottom: 4 }}>HDG</div>
      <svg viewBox="0 0 380 40" style={{ width: "100%", height: 40, filter: SVG_FILTER }}>
        <line x1="20" y1="20" x2="360" y2="20" stroke={COLORS.green} strokeWidth="1" opacity="0.3" />
        {visible.map((v, i) => (
          <g key={i}>
            <line x1={v.x} y1="20" x2={v.x} y2="14" stroke={COLORS.green} strokeWidth="1.2" opacity="0.4" />
            <text x={v.x} y="38" fontSize="11" fill={COLORS.green} opacity="0.45" textAnchor="middle" fontFamily='"Roboto Mono", monospace'>{pad(v.h / 10, 2)}</text>
          </g>
        ))}
        <polygon points="190,0 183,8 197,8" fill={COLORS.green} opacity="0.8" />
      </svg>
      <div style={{ ...txt(COLORS.green, 22, 0.9, true), textAlign: "center", marginTop: 4 }}>{pad(heading, 3)}°</div>
    </div>
  );
};

const MiniHeading = ({ heading }) => (
  <div style={{ textAlign: "center" }}>
    <svg viewBox="0 0 160 14" style={{ width: 160, height: 14, filter: SVG_FILTER }}>
      <line x1="10" y1="7" x2="150" y2="7" stroke={COLORS.green} strokeWidth="0.8" opacity="0.5" />
      <line x1="40" y1="7" x2="40" y2="2" stroke={COLORS.green} strokeWidth="1" />
      <line x1="80" y1="7" x2="80" y2="0" stroke={COLORS.green} strokeWidth="1.2" />
      <line x1="120" y1="7" x2="120" y2="2" stroke={COLORS.green} strokeWidth="1" />
    </svg>
    <div style={{ ...txt(COLORS.green, 24, 1, false, 1), marginTop: 4 }}>{pad(heading, 3)}°</div>
  </div>
);

const Localizer = ({ deviation = 0 }) => {
  const cx = clamp(170 + deviation * 110, 30, 310);
  return (
    <div style={{ position: "relative", width: 340 }}>
      <svg viewBox="0 0 340 30" style={{ width: 340, height: 30, filter: SVG_FILTER }}>
        <line x1="20" y1="15" x2="320" y2="15" stroke={COLORS.green} strokeWidth="0.8" opacity="0.3" />
        {[50, 110, 170, 230, 290].map((x, i) => (
          <circle key={x} cx={x} cy="15" r="5" fill={i === 2 ? COLORS.green : "none"} stroke={COLORS.green} strokeWidth="1.5" opacity={i === 2 ? 1 : 0.6} />
        ))}
        <polygon points={cx - 10 + ",15 " + cx + ",7 " + (cx + 10) + ",15 " + cx + ",23"} fill={COLORS.magenta} stroke={COLORS.magenta} strokeWidth="1" style={{ transition: "all 80ms linear" }} />
      </svg>
      <div style={{ ...txt(COLORS.magenta, 13, 0.55, true, 1), textAlign: "center", marginTop: 2 }}>LOC</div>
    </div>
  );
};

const Glideslope = ({ deviation = 0 }) => {
  const cy = clamp(170 + deviation * 110, 30, 310);
  return (
    <div style={{ position: "relative", width: 40 }}>
      <svg viewBox="0 0 30 340" style={{ width: 40, height: 340, filter: SVG_FILTER }}>
        <line x1="15" y1="20" x2="15" y2="320" stroke={COLORS.green} strokeWidth="0.8" opacity="0.3" />
        {[50, 110, 170, 230, 290].map((y, i) => (
          <circle key={y} cx="15" cy={y} r="5" fill={i === 2 ? COLORS.green : "none"} stroke={COLORS.green} strokeWidth="1.5" opacity={i === 2 ? 1 : 0.6} />
        ))}
        <polygon points={"15," + (cy - 10) + " 23," + cy + " 15," + (cy + 10) + " 7," + cy} fill={COLORS.magenta} stroke={COLORS.magenta} strokeWidth="1" style={{ transition: "all 80ms linear" }} />
      </svg>
      <div style={{ ...txt(COLORS.magenta, 13, 0.55, true, 1), textAlign: "center", marginTop: 2 }}>GS</div>
    </div>
  );
};

const Wind = ({ value, opacity = 1 }) => (
  <div style={{ opacity, transition: "opacity 800ms ease-in-out" }}>
    <div style={{ ...txt(COLORS.cyan, 13, 1, true, 1) }}>WIND</div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
      <span style={{ ...txt(COLORS.cyan, 15) }}>{value}</span>
      <svg width="32" height="14" viewBox="0 0 32 14" style={{ filter: SVG_FILTER }}>
        <line x1="2" y1="7" x2="24" y2="7" stroke={COLORS.cyan} strokeWidth="1.5" />
        <polygon points="24,2 30,7 24,12" fill={COLORS.cyan} />
      </svg>
    </div>
  </div>
);

const PhasePill = ({ label, color, opacity = 0.4, bg = false }) => (
  <div style={{ display: "inline-block", padding: "5px 14px", border: "1.5px solid " + color, borderRadius: 4, opacity, background: bg ? "rgba(255,51,51,0.12)" : "transparent", transition: "opacity 800ms ease-in-out" }}>
    <span style={{ ...txt(color, 15, 1, true, 2) }}>{label}</span>
  </div>
);

const AirportArrow = ({ label, opacity, direction, position }) => (
  <div style={{ position: "absolute", ...position, opacity, transition: "opacity 400ms ease-in-out" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {direction === "left-up" && (
        <svg width="50" height="50" viewBox="0 0 50 50" style={{ filter: SVG_FILTER }}>
          <line x1="40" y1="40" x2="14" y2="14" stroke={COLORS.cyan} strokeWidth="2" />
          <polygon points="14,14 24,12 12,24" fill={COLORS.cyan} />
        </svg>
      )}
      <span style={{ ...txt(COLORS.cyan, 15, 1, true) }}>{label}</span>
      {direction === "right-up" && (
        <svg width="50" height="50" viewBox="0 0 50 50" style={{ filter: SVG_FILTER }}>
          <line x1="10" y1="40" x2="36" y2="14" stroke={COLORS.cyan} strokeWidth="2" />
          <polygon points="36,14 26,12 38,24" fill={COLORS.cyan} />
        </svg>
      )}
      {direction === "lower-left" && (
        <svg width="50" height="50" viewBox="0 0 50 50" style={{ filter: SVG_FILTER }}>
          <line x1="40" y1="10" x2="14" y2="36" stroke={COLORS.cyan} strokeWidth="2" />
          <polygon points="14,36 24,38 12,26" fill={COLORS.cyan} />
        </svg>
      )}
    </div>
  </div>
);

// ============================================================
// EMERGENCY PROCEDURE PANEL — click to advance, then recovery
// ============================================================

const ENGINE_PROCEDURE = [
  "AIRSPEED — 65 KT GLIDE",
  "FUEL SELECTOR — BOTH",
  "MIXTURE — RICH",
  "CARB HEAT — ON",
  "IGNITION — BOTH / START",
  "IF NO RESTART — LAND",
];

const ELEC_PROCEDURE = [
  "ALTERNATOR — CHECK",
  "NON-ESSENTIAL BUS — OFF",
  "AVIONICS MASTER — OFF",
  "LAND AS SOON AS PRACTICAL",
  "DECLARE EMERGENCY IF NEEDED",
];

const ProcedurePanel = ({ variant, step, onAdvance, bannerColor, recovered }) => {
  const steps = variant === "engine" ? ENGINE_PROCEDURE : ELEC_PROCEDURE;
  const title =
    variant === "engine" ? "ENGINE FAILURE PROCEDURE" : "ELECTRICAL FAILURE PROCEDURE";
  const STEP_H = 38;
  const borderColor = recovered ? COLORS.recovered : bannerColor;
  return (
    <div
      onClick={onAdvance}
      style={{
        background: recovered ? "rgba(0,40,30,0.65)" : "rgba(0,0,0,0.62)",
        border: "1px solid " + borderColor + "99",
        borderRadius: 6,
        padding: "14px 18px",
        cursor: "pointer",
        userSelect: "none",
        boxShadow: "0 0 24px rgba(0,0,0,0.6)",
        transition: "background 700ms ease-out, border-color 700ms ease-out",
      }}
    >
      <div
        style={{
          ...txt(COLORS.label, 12, 1, true, 1.5),
          marginBottom: 10,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span style={{ color: recovered ? COLORS.recovered : COLORS.label, opacity: 0.85 }}>
          {recovered ? "PROCEDURE COMPLETE" : title}
        </span>
        <span style={{ color: COLORS.cyan, opacity: 0.7 }}>
          {recovered
            ? "CLICK TO RESET"
            : Math.min(step + 1, steps.length) + " / " + steps.length + " — CLICK TO ADVANCE"}
        </span>
      </div>
      <div style={{ position: "relative", height: STEP_H * steps.length }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: Math.min(step, steps.length - 1) * STEP_H,
            height: STEP_H,
            background: recovered ? "rgba(0,255,136,0.14)" : "rgba(0,229,255,0.18)",
            borderLeft: "3px solid " + (recovered ? COLORS.recovered : COLORS.cyan),
            borderRadius: 3,
            transition: "top 350ms cubic-bezier(0.4, 0, 0.2, 1), background 600ms",
            opacity: recovered ? 0 : 1,
          }}
        />
        {steps.map((s, i) => {
          const done = i < step || recovered;
          const active = i === step && !recovered;
          const color = active ? COLORS.cyan : done ? COLORS.recovered : "#fff";
          const op = active ? 1 : done ? 0.85 : 0.3;
          return (
            <div key={i} style={{ position: "absolute", top: i * STEP_H, left: 0, right: 0, height: STEP_H, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, transition: "all 300ms" }}>
              <span style={{ ...txt(color, 14, op, true, 0.5), width: 22, textAlign: "center" }}>
                {done ? "✓" : i + 1 + "."}
              </span>
              <span style={{ ...txt(color, active ? 18 : 16, op, active, 0.5) }}>{s}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// MAIN APP
// ============================================================

const PHASES = [
  { id: "taxi", label: "TAXI", full: "Taxi / Pre-Takeoff" },
  { id: "takeoff", label: "TAKEOFF", full: "Takeoff" },
  { id: "cruise", label: "CRUISE", full: "Cruise" },
  { id: "approach", label: "APPROACH", full: "Approach / Landing" },
  { id: "emergency", label: "EMERGENCY", full: "Emergency" },
];

const PHASE_BASE = {
  taxi: { heading: 260, alt: 0, ias: 8, trend: 0 },
  takeoff: { heading: 260, alt: 0, ias: 60, trend: 1 },
  cruise: { heading: 248, alt: 5500, ias: 105, trend: 0 },
  approach: { heading: 260, alt: 720, ias: 72, trend: -1 },
  emergency: { heading: 240, alt: 4200, ias: 68, trend: -1 },
};

export default function App() {
  const [phase, setPhase] = useState("taxi");
  const [emergencyVariant, setEmergencyVariant] = useState("engine");
  const [arOn, setArOn] = useState(true);
  const [emergencyStep, setEmergencyStep] = useState(0);
  const [mouse, setMouse] = useState({ mx: 0, my: 0 });
  const [scale, setScale] = useState(1);
  const [takeoffProgress, setTakeoffProgress] = useState(0);
  const [taxiGS, setTaxiGS] = useState(0);
  const canvasRef = useRef(null);

  const phaseInfo = PHASES.find((p) => p.id === phase);
  const isEmergency = phase === "emergency";
  const transitionDuration = isEmergency ? 400 : 800;
  const base = PHASE_BASE[phase];

  // Emergency recovery state
  const procLen =
    emergencyVariant === "engine" ? ENGINE_PROCEDURE.length : ELEC_PROCEDURE.length;
  const recovered = isEmergency && emergencyStep >= procLen;

  // Takeoff-phase derived values
  // 0–3s ground roll, 3–4.5s rotation, 4.5–15s climb
  const tRoll = clamp(takeoffProgress / 0.3, 0, 1);
  const tRot = clamp((takeoffProgress - 0.3) / 0.15, 0, 1);
  const tClimb = clamp((takeoffProgress - 0.45) / 0.55, 0, 1);
  const takeoffIAS = lerp(60, 95, easeOut(takeoffProgress));
  const takeoffAlt = tClimb > 0 ? Math.round(easeInOut(tClimb) * 1500) : 0;
  const takeoffPitchPx = -easeInOut(tRot) * 25 + easeInOut(tClimb) * 5; // pitch up then settle

  // Mouse-derived values (apply for all phases, but takeoff overrides altitude/IAS)
  const bank = mouse.mx * 22;
  const pitchMouse = mouse.my * 35;
  const heading = ((base.heading + mouse.mx * 25) + 360) % 360;
  const altMouse = base.alt + -mouse.my * 250;
  const iasMouse = clamp(base.ias + -mouse.my * 8, 0, 200);
  const verticalSpeed = Math.round(-mouse.my * 800);
  const locDev = mouse.mx;
  const gsDev = mouse.my;

  // Phase-specific final values
  const ias = phase === "takeoff" ? takeoffIAS : iasMouse;
  const altitude = phase === "takeoff" ? takeoffAlt : altMouse;
  const pitch = phase === "takeoff" ? pitchMouse + takeoffPitchPx : pitchMouse;

  // Uniform scaling to viewport
  useEffect(() => {
    const recalc = () => {
      const s = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
      setScale(s);
    };
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);

  // Mouse tracking
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const mx = clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
      const my = clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
      setMouse({ mx, my });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Reset procedure step on variant/phase change
  useEffect(() => {
    setEmergencyStep(0);
  }, [emergencyVariant, phase]);

  // Takeoff 15-second cinematic (looping)
  useEffect(() => {
    if (phase !== "takeoff") {
      setTakeoffProgress(0);
      return;
    }
    const start = Date.now();
    let raf;
    const tick = () => {
      const t = ((Date.now() - start) % 15000) / 15000;
      setTakeoffProgress(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Taxi GS — slowly accelerates from 0 to ~18 KT over time (mouse-independent)
  useEffect(() => {
    if (phase !== "taxi") {
      setTaxiGS(0);
      return;
    }
    const start = Date.now();
    let raf;
    const tick = () => {
      const elapsed = (Date.now() - start) / 1000; // seconds
      // ease toward 18 KT over ~22s, then small idle oscillation
      const target = 18;
      const eased = target * (1 - Math.exp(-elapsed / 7));
      const wobble = elapsed > 18 ? Math.sin(elapsed * 0.6) * 0.4 : 0;
      setTaxiGS(eased + wobble);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Fonts + keyframes
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@300;400;500;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.textContent =
      "@keyframes emergencyPulse { 0%,100% { opacity:0.30 } 50% { opacity:0.12 } }" +
      "@keyframes bannerPulse { 0%,100% { background:rgba(160,0,0,0.30) } 50% { background:rgba(200,0,0,0.45) } }" +
      "@keyframes amberBannerPulse { 0%,100% { background:rgba(140,90,0,0.25) } 50% { background:rgba(200,130,0,0.40) } }" +
      "@keyframes cloudDrift { 0% { transform:translateX(0) } 100% { transform:translateX(160vw) } }" +
      "@keyframes taxiScroll { 0% { background-position:0 0 } 100% { background-position:0 110px } }" +
      "@keyframes rwyScroll  { 0% { background-position:0 0 } 100% { background-position:0 110px } }" +
      "@keyframes recoveredGlow { 0%,100% { box-shadow:0 0 20px rgba(0,255,136,0.4) } 50% { box-shadow:0 0 32px rgba(0,255,136,0.7) } }" +
      "body { margin:0; background:#000; overflow:hidden; cursor:crosshair }";
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(link);
      document.head.removeChild(style);
    };
  }, []);

  const bannerColor = recovered
    ? COLORS.recovered
    : emergencyVariant === "engine"
    ? COLORS.red
    : COLORS.amber;
  const bannerLabel = recovered
    ? "SYSTEM RESTORED"
    : emergencyVariant === "engine"
    ? "ENGINE FAILURE"
    : "ELECTRICAL FAILURE";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        ref={canvasRef}
        style={{
          width: DESIGN_W,
          height: DESIGN_H,
          position: "relative",
          overflow: "hidden",
          transform: "scale(" + scale + ")",
          transformOrigin: "center center",
          background: "#000",
          fontFamily: '"Roboto Mono", ui-monospace, monospace',
          userSelect: "none",
        }}
      >
        {/* ===== WINDSHIELD (clipped) — background + AR overlay live here ===== */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: WINDSHIELD_PX,
            overflow: "hidden",
          }}
        >
          <PhaseBackground
            phase={phase}
            bank={bank}
            pitch={pitch}
            variant={emergencyVariant}
            recovered={recovered}
            takeoffProgress={takeoffProgress}
          />

          {/* AR OVERLAY */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: arOn ? 1 : 0,
              transition: "opacity 600ms ease-in-out",
              pointerEvents: arOn ? "auto" : "none",
            }}
          >
            {/* Emergency border */}
            <div
              style={{
                position: "absolute",
                top: 20,
                left: 20,
                right: 20,
                bottom: 20,
                border: "3px solid " + bannerColor,
                borderRadius: 12,
                opacity: isEmergency && !recovered ? 0.3 : 0,
                animation: isEmergency && !recovered ? "emergencyPulse 2s ease-in-out infinite" : "none",
                transition: "opacity 800ms ease-in-out",
                pointerEvents: "none",
              }}
            />

            {/* Phase indicator (top-left) */}
            <div style={{ position: "absolute", top: 30, left: 40 }}>
              <Fade visible={phase === "taxi"} duration={transitionDuration} style={{ position: "absolute" }}>
                <PhasePill label="TAXI" color={COLORS.green} opacity={0.55} />
              </Fade>
              <Fade visible={phase === "takeoff"} duration={transitionDuration} style={{ position: "absolute" }}>
                <PhasePill label="TAKEOFF" color={COLORS.green} opacity={0.5} />
                <div style={{ marginTop: 10, whiteSpace: "nowrap" }}>
                  <span style={{ ...txt(COLORS.amber, 12, 0.6, true, 1), whiteSpace: "nowrap" }}>T.O. INHIBIT ACTIVE</span>
                </div>
              </Fade>
              <Fade visible={phase === "approach"} duration={transitionDuration} style={{ position: "absolute" }}>
                <PhasePill label="APPROACH" color={COLORS.green} opacity={0.5} />
              </Fade>
              <Fade visible={isEmergency} duration={transitionDuration} style={{ position: "absolute" }}>
                <PhasePill label={recovered ? "RECOVERED" : "EMERGENCY"} color={bannerColor} opacity={0.7} bg={!recovered} />
              </Fade>
            </div>

            {/* Cruise label */}
            <Fade visible={phase === "cruise"} opacity={0.16} duration={transitionDuration} style={{ position: "absolute", top: 28, left: "50%", transform: "translateX(-50%)" }}>
              <span style={{ ...txt(COLORS.green, 16, 1, false, 3) }}>CRUISE</span>
            </Fade>

            {/* === TAXI INFO === */}
            <Fade visible={phase === "taxi"} opacity={0.65} duration={transitionDuration} style={{ position: "absolute", bottom: 110, left: 60 }}>
              <div style={{ ...txt(COLORS.label, 13, 1, true, 1) }}>GS</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                <span style={{ ...txt(COLORS.green, 28, 1, true) }}>{Math.round(taxiGS)}</span>
                <span style={{ ...txt(COLORS.green, 12, 0.5, true) }}>KT</span>
              </div>
            </Fade>
            <Fade visible={phase === "taxi"} opacity={0.7} duration={transitionDuration} style={{ position: "absolute", top: 30, right: 50, textAlign: "right" }}>
              <div style={{ ...txt(COLORS.label, 13, 1, true, 1), marginBottom: 8 }}>CONFIG</div>
              <div style={{ ...txt(COLORS.green, 13, 1, false, 0.5), marginBottom: 4 }}>✓ FLAPS SET</div>
              <div style={{ ...txt(COLORS.green, 13, 1, false, 0.5), marginBottom: 4 }}>✓ TRIM SET</div>
              <div style={{ ...txt(COLORS.green, 13, 1, false, 0.5), marginBottom: 4 }}>✓ FUEL SELECTOR</div>
              <div style={{ ...txt(COLORS.cyan, 13, 1, true, 0.5) }}>○ CONTROLS FREE</div>
            </Fade>
            <Fade visible={phase === "taxi"} opacity={0.6} duration={transitionDuration} style={{ position: "absolute", bottom: 110, right: 60, textAlign: "right" }}>
              <div style={{ ...txt(COLORS.label, 13, 1, true, 1), marginBottom: 4 }}>ENG</div>
              <div style={{ ...txt(COLORS.green, 15) }}>RPM 1000</div>
              <div style={{ ...txt(COLORS.green, 15) }}>OIL OK</div>
            </Fade>
            <Fade visible={phase === "taxi"} opacity={0.65} duration={transitionDuration} style={{ position: "absolute", bottom: 30, right: 120 }}>
              <Wind value="230° / 8KT" />
            </Fade>

            {/* === TAKEOFF / APPROACH: AIRSPEED TAPE === */}
            <Fade visible={phase === "takeoff"} opacity={0.95} duration={transitionDuration} style={{ position: "absolute", top: 170, left: 90 }}>
              <AirspeedTape value={ias} vrefMark="VR 55" vyMark="VY 76" trend={1} />
            </Fade>
            <Fade visible={phase === "approach"} opacity={0.92} duration={transitionDuration} style={{ position: "absolute", top: 100, left: 90 }}>
              <AirspeedTape value={ias} vrefMark="Vref 65" trend={-1} />
            </Fade>
            {/* ILS frequency block — placed below the airspeed tape so it never
                crowds the cyan VREF marker on the tape's left side. */}
            <Fade visible={phase === "approach"} opacity={0.95} duration={transitionDuration} style={{ position: "absolute", top: 360, left: 40 }}>
              <div style={{ ...txt(COLORS.magenta, 13, 0.6, true, 1) }}>ILS RWY 26</div>
              <div style={{ ...txt(COLORS.magenta, 12, 0.55), marginTop: 2 }}>110.10 MHz</div>
            </Fade>

            {/* === ATTITUDE === */}
            <div style={{ position: "absolute", top: 80, left: "50%", transform: "translateX(-50%)", display: "flex", justifyContent: "center" }}>
              {phase === "takeoff" && <Attitude opacity={0.92} bank={bank} pitch={pitch} />}
              {phase === "approach" && <Attitude opacity={0.9} bank={bank} pitch={pitch} withFPV />}
              {isEmergency && <Attitude opacity={0.95} thick bank={bank} pitch={pitch} />}
            </div>

            {/* === APPROACH: LOC + GS + ALT === */}
            <Fade visible={phase === "approach"} opacity={0.9} duration={transitionDuration} style={{ position: "absolute", top: 330, left: "50%", transform: "translateX(-50%)" }}>
              <Localizer deviation={locDev} />
            </Fade>
            <Fade visible={phase === "approach"} opacity={0.9} duration={transitionDuration} style={{ position: "absolute", top: 100, right: "30%" }}>
              <Glideslope deviation={gsDev} />
            </Fade>
            <Fade visible={phase === "approach"} opacity={0.92} duration={transitionDuration} style={{ position: "absolute", top: 100, right: 90 }}>
              <AltitudeTape value={altitude} />
            </Fade>
            <Fade visible={phase === "approach"} opacity={0.95} duration={transitionDuration} style={{ position: "absolute", top: 360, right: 65, textAlign: "right" }}>
              <div style={{ ...txt(COLORS.cyan, 13, 1, true, 1) }}>RA</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: "flex-end" }}>
                <span style={{ ...txt(COLORS.cyan, 32, 1, true) }}>{pad(clamp(altitude - 300, 0, 9999), 3)}</span>
                <span style={{ ...txt(COLORS.cyan, 12, 0.7, true) }}>FT</span>
              </div>
            </Fade>
            <Fade visible={phase === "approach"} opacity={0.65} duration={transitionDuration} style={{ position: "absolute", top: 105, right: 240, textAlign: "right" }}>
              <div style={{ ...txt(COLORS.label, 12, 1, true, 1) }}>VS</div>
              <div style={{ ...txt(COLORS.green, 18, 1, true) }}>{verticalSpeed}</div>
              <div style={{ ...txt(COLORS.green, 11, 0.5) }}>FPM</div>
            </Fade>
            <Fade visible={phase === "approach"} opacity={0.7} duration={transitionDuration} style={{ position: "absolute", bottom: 30, left: 70 }}>
              <div style={{ ...txt(COLORS.green, 14) }}>FLAPS 30°</div>
              <div style={{ ...txt(COLORS.green, 14), marginTop: 4 }}>FUEL SEL ✓</div>
            </Fade>
            <Fade visible={phase === "approach"} opacity={0.6} duration={transitionDuration} style={{ position: "absolute", bottom: 30, right: 120 }}>
              <Wind value="240° / 12KT" />
            </Fade>

            {/* TAKEOFF: ALT readout + RPM */}
            <Fade visible={phase === "takeoff"} opacity={0.85} duration={transitionDuration} style={{ position: "absolute", top: 100, right: 90, textAlign: "right" }}>
              <div style={{ ...txt(COLORS.label, 13, 1, true, 1) }}>ALT</div>
              <div style={{ ...txt(COLORS.green, 32, 1, true), marginTop: 4 }}>{Math.round(altitude)}</div>
              <div style={{ ...txt(COLORS.green, 11, 0.5) }}>FT</div>
            </Fade>
            <Fade visible={phase === "takeoff"} opacity={0.55} duration={transitionDuration} style={{ position: "absolute", bottom: 30, right: 90, textAlign: "right" }}>
              <div style={{ ...txt(COLORS.label, 13, 1, true, 1) }}>RPM</div>
              <div style={{ ...txt(COLORS.green, 20, 1, true), marginTop: 2 }}>{Math.round(lerp(2400, 2500, tRoll))}</div>
            </Fade>

            {/* HEADING TAPE bottom of windshield (taxi + approach) */}
            <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", width: 380 }}>
              <Fade visible={phase === "taxi"} opacity={0.6} duration={transitionDuration} style={{ position: "absolute", left: -190, top: 0, width: 380 }}>
                <HeadingTape heading={heading} />
              </Fade>
              <Fade visible={phase === "approach"} opacity={0.65} duration={transitionDuration} style={{ position: "absolute", left: -190, top: 0, width: 380 }}>
                <HeadingTape heading={heading} />
              </Fade>
            </div>

            {/* CRUISE info */}
            <Fade visible={phase === "cruise"} opacity={0.22} duration={transitionDuration} style={{ position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)" }}>
              <MiniHeading heading={heading} />
            </Fade>
            <Fade visible={phase === "cruise"} opacity={0.22} duration={transitionDuration} style={{ position: "absolute", top: 40, right: 60, textAlign: "right" }}>
              <div style={{ ...txt(COLORS.label, 13, 1, true, 1) }}>ALT</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: "flex-end", marginTop: 2 }}>
                <span style={{ ...txt(COLORS.green, 26) }}>{Math.round(altitude)}</span>
                <span style={{ ...txt(COLORS.green, 12, 0.5) }}>FT</span>
              </div>
            </Fade>
            <Fade visible={phase === "cruise"} opacity={0.2} duration={transitionDuration} style={{ position: "absolute", top: 40, left: 60 }}>
              <div style={{ ...txt(COLORS.label, 13, 1, true, 1) }}>NEXT</div>
              <div style={{ ...txt(COLORS.green, 22), marginTop: 2 }}>LIBMA</div>
              <div style={{ ...txt(COLORS.green, 12, 0.5) }}>42 NM</div>
            </Fade>
            <Fade visible={phase === "cruise"} opacity={0.2} duration={transitionDuration} style={{ position: "absolute", bottom: 60, left: 60 }}>
              <div style={{ ...txt(COLORS.label, 13, 1, true, 1) }}>FUEL</div>
              <div style={{ ...txt(COLORS.green, 22), marginTop: 2 }}>3.2 HR</div>
            </Fade>

            {/* === EMERGENCY BANNER === */}
            <Fade visible={isEmergency} opacity={1} duration={transitionDuration} style={{ position: "absolute", top: 30, left: "50%", transform: "translateX(-50%)" }}>
              <div
                style={{
                  padding: "14px 40px",
                  border: "2px solid " + bannerColor,
                  borderRadius: 6,
                  animation: recovered
                    ? "recoveredGlow 2.4s ease-in-out infinite"
                    : (emergencyVariant === "engine" ? "bannerPulse" : "amberBannerPulse") +
                      " 1.4s ease-in-out infinite",
                  boxShadow: "0 0 20px " + bannerColor + "66",
                  transition: "border-color 800ms ease-out",
                  background: recovered ? "rgba(0,80,40,0.35)" : undefined,
                }}
              >
                <span style={{ ...txt(bannerColor, 26, 1, true, 3) }}>{bannerLabel}</span>
              </div>
            </Fade>

            {/* === PROCEDURE PANEL (always visible in emergency) === */}
            <Fade
              visible={isEmergency}
              opacity={0.96}
              duration={transitionDuration}
              style={{
                position: "absolute",
                top: 105,
                left: "50%",
                transform: "translateX(-50%)",
                width: 540,
                zIndex: 6,
              }}
            >
              <ProcedurePanel
                variant={emergencyVariant}
                step={emergencyStep}
                onAdvance={() => setEmergencyStep((s) => (s + 1 > procLen ? 0 : s + 1))}
                bannerColor={emergencyVariant === "engine" ? COLORS.red : COLORS.amber}
                recovered={recovered}
              />
            </Fade>

            {/* === RECOVERY CONFIRMATION CARD === */}
            <Fade
              visible={isEmergency && recovered}
              opacity={1}
              duration={900}
              style={{
                position: "absolute",
                bottom: 40,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 6,
              }}
            >
              <div
                style={{
                  background: "rgba(0,40,30,0.7)",
                  border: "1.5px solid " + COLORS.recovered,
                  borderRadius: 6,
                  padding: "12px 24px",
                  textAlign: "center",
                  boxShadow: "0 0 30px rgba(0,255,136,0.35)",
                  minWidth: 360,
                }}
              >
                <div style={{ ...txt(COLORS.recovered, 12, 1, true, 1.5), marginBottom: 4 }}>✓ RECOVERY CONFIRMED</div>
                <div style={{ ...txt("#ffffff", 14, 0.85, false, 0.5) }}>
                  ALL SYSTEMS NOMINAL — RESUMING NORMAL OPERATION
                </div>
              </div>
            </Fade>

            {/* === EMERGENCY: side data + airport arrows (hidden after recovery) === */}
            <Fade visible={isEmergency && !recovered} opacity={0.95} duration={transitionDuration} style={{ position: "absolute", bottom: 90, left: 70 }}>
              <div style={{ border: "1.5px solid " + COLORS.green, background: "rgba(0,0,0,0.55)", padding: "8px 18px", borderRadius: 4, textAlign: "center", boxShadow: TEXT_SHADOW }}>
                <div style={{ ...txt(COLORS.label, 11, 1, true, 1.5), marginBottom: 4 }}>IAS</div>
                <div style={{ ...txt(COLORS.green, 36, 1, true) }}>{Math.round(ias)}</div>
              </div>
              {emergencyVariant === "engine" && (
                <div style={{ ...txt(COLORS.cyan, 15, 1, true, 1), marginTop: 8, textAlign: "center" }}>GLIDE 65KT</div>
              )}
              {emergencyVariant === "electrical" && (
                <>
                  <div style={{ ...txt(COLORS.amber, 14, 1, true, 1), marginTop: 14 }}>BATT 11.2V LOW</div>
                  <div style={{ ...txt(COLORS.amber, 12, 0.8, false, 0.5), marginTop: 4 }}>EST BATT ~28 MIN</div>
                </>
              )}
            </Fade>
            <Fade visible={isEmergency && !recovered} opacity={0.95} duration={transitionDuration} style={{ position: "absolute", bottom: 90, right: 70 }}>
              <div style={{ border: "1.5px solid " + COLORS.green, background: "rgba(0,0,0,0.55)", padding: "8px 18px", borderRadius: 4, textAlign: "center", boxShadow: TEXT_SHADOW }}>
                <div style={{ ...txt(COLORS.label, 11, 1, true, 1.5), marginBottom: 4 }}>ALT</div>
                <div style={{ ...txt(COLORS.green, 36, 1, true) }}>{Math.round(altitude)}</div>
              </div>
              {emergencyVariant === "electrical" && (
                <div style={{ marginTop: 10, padding: "8px 12px", border: "1.5px solid " + COLORS.amber, background: "rgba(255,165,0,0.1)", borderRadius: 4, textAlign: "center" }}>
                  <div style={{ ...txt(COLORS.amber, 13, 1, true, 0.5) }}>LAND WITHIN</div>
                  <div style={{ ...txt(COLORS.amber, 18, 1, true) }}>~28 MIN</div>
                </div>
              )}
            </Fade>
            {isEmergency && !recovered && (
              <>
                <AirportArrow label="LTBJ 8.4 NM" opacity={0.78} direction="left-up" position={{ top: 380, left: 240 }} />
                <AirportArrow label="LTBR 14.2 NM" opacity={0.58} direction="right-up" position={{ top: 380, right: 240 }} />
                {emergencyVariant === "engine" && (
                  <AirportArrow label="LTFE 22.7 NM" opacity={0.42} direction="lower-left" position={{ bottom: 60, left: 210 }} />
                )}
              </>
            )}
          </div>
        </div>

        {/* ===== COCKPIT SILHOUETTE (below windshield) ===== */}
        <Cockpit />

        {/* ===== CONTROLS — outside windshield, over cockpit ===== */}

        {/* Emergency variant toggle (top-right, only in emergency) */}
        {isEmergency && (
          <div
            style={{
              position: "absolute",
              top: 25,
              right: 25,
              zIndex: 10,
              display: "flex",
              gap: 6,
            }}
          >
            <button
              onClick={() => setEmergencyVariant("engine")}
              style={{
                background: emergencyVariant === "engine" ? "rgba(255,51,51,0.2)" : "rgba(20,20,20,0.6)",
                border: "1px solid " + (emergencyVariant === "engine" ? COLORS.red : "#444"),
                color: emergencyVariant === "engine" ? COLORS.red : "#777",
                padding: "6px 12px",
                borderRadius: 3,
                fontFamily: '"Roboto Mono", monospace',
                fontSize: 11,
                letterSpacing: 1,
                cursor: "pointer",
                textShadow: TEXT_SHADOW,
              }}
            >
              ENGINE FAIL
            </button>
            <button
              onClick={() => setEmergencyVariant("electrical")}
              style={{
                background: emergencyVariant === "electrical" ? "rgba(255,165,0,0.2)" : "rgba(20,20,20,0.6)",
                border: "1px solid " + (emergencyVariant === "electrical" ? COLORS.amber : "#444"),
                color: emergencyVariant === "electrical" ? COLORS.amber : "#777",
                padding: "6px 12px",
                borderRadius: 3,
                fontFamily: '"Roboto Mono", monospace',
                fontSize: 11,
                letterSpacing: 1,
                cursor: "pointer",
                textShadow: TEXT_SHADOW,
              }}
            >
              ELEC FAIL
            </button>
          </div>
        )}

        {/* Phase nav (bottom-center, over cockpit) */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 8,
            zIndex: 10,
          }}
        >
          {PHASES.map((p) => {
            const active = p.id === phase;
            const accent = p.id === "emergency" ? COLORS.red : COLORS.green;
            return (
              <button
                key={p.id}
                onClick={() => setPhase(p.id)}
                style={{
                  background: active ? accent + "25" : "rgba(10,12,15,0.85)",
                  border: "1.5px solid " + (active ? accent : "#2a3138"),
                  color: active ? accent : "#7a8188",
                  padding: "8px 18px",
                  borderRadius: 20,
                  fontFamily: '"Roboto Mono", monospace',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 2,
                  cursor: "pointer",
                  textShadow: TEXT_SHADOW,
                  transition: "all 250ms",
                  backdropFilter: "blur(4px)",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* AR ON/OFF toggle — bottom-right, over cockpit */}
        <div style={{ position: "absolute", bottom: 32, right: 30, zIndex: 10 }}>
          <button
            onClick={() => setArOn(!arOn)}
            style={{
              background: arOn ? "rgba(0,255,68,0.12)" : "rgba(40,40,40,0.7)",
              border: "1.5px solid " + (arOn ? COLORS.green : "#555"),
              color: arOn ? COLORS.green : "#888",
              padding: "8px 16px",
              borderRadius: 4,
              fontFamily: '"Roboto Mono", monospace',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              cursor: "pointer",
              textShadow: TEXT_SHADOW,
              transition: "all 250ms",
            }}
          >
            AR {arOn ? "ON" : "OFF"}
          </button>
        </div>

        {/* Title bar */}
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            ...txt("#ffffff", 10, 0.32, false, 1.5),
            whiteSpace: "nowrap",
            zIndex: 5,
          }}
        >
          Adaptive AR Information Overlay — Phase {PHASES.findIndex((p) => p.id === phase) + 1}: {phaseInfo.full}
          {phase === "takeoff" ? "  ·  T+" + (takeoffProgress * 15).toFixed(1) + "s" : "  ·  move mouse to fly"}
        </div>
      </div>
    </div>
  );
}
