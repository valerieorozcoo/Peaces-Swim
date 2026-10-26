import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/*
 * Seamless looping montage for the Peaces Swim landing-page hero.
 * Each shot holds for SHOT frames and cross-fades into the next over FADE frames.
 * The last shot fades back into the first, and every shot's zoom is driven by a
 * time value taken modulo the loop length, so frame `duration` === frame 0:
 * the clip can loop forever with no visible jump.
 */

const FPS = 30;
const SHOT = 4 * FPS; // 4s on screen per photo
const FADE = 1.2 * FPS; // 1.2s cross-fade

type Shot = { src: string; pos?: string; zoomFrom?: number; zoomTo?: number; panX?: number };

const DESKTOP: Shot[] = [
  { src: "hero-poster.jpg", pos: "50% 50%" },
  { src: "flatlay.jpg", pos: "55% 50%", zoomFrom: 1.14, zoomTo: 1.02 },
  { src: "sewing-rollers.jpg", pos: "50% 45%", panX: -2 },
  { src: "party.jpg", pos: "50% 40%", zoomFrom: 1.12, zoomTo: 1.02 },
  { src: "sewing-closeup.jpg", pos: "40% 50%" },
  { src: "tower-standing.jpg", pos: "50% 35%", zoomFrom: 1.12, zoomTo: 1.02 },
];

const MOBILE: Shot[] = [
  { src: "styling-overhead.jpg", pos: "50% 50%" },
  { src: "walking-away.jpg", pos: "50% 50%", zoomFrom: 1.12, zoomTo: 1.02 },
  { src: "sewing-rollers.jpg", pos: "62% 50%" },
  { src: "waitlist.jpg", pos: "50% 55%", zoomFrom: 1.12, zoomTo: 1.02 },
  { src: "party.jpg", pos: "45% 50%" },
  { src: "waitlist-couch.jpg", pos: "50% 50%", zoomFrom: 1.12, zoomTo: 1.02 },
];

const loopLength = (shots: Shot[]) => shots.length * SHOT;

const Montage: React.FC<{ shots: Shot[] }> = ({ shots }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const total = durationInFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: "#2E2433" }}>
      {shots.map((shot, i) => {
        const start = i * SHOT;
        const life = SHOT + FADE;
        // local time for this shot, wrapped so the loop closes cleanly
        const local = (((frame - start) % total) + total) % total;
        if (local >= life) return null;

        const opacity = interpolate(local, [0, FADE], [0, 1], {
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.quad),
        });
        const scale = interpolate(local, [0, life], [shot.zoomFrom ?? 1.02, shot.zoomTo ?? 1.14]);
        const tx = interpolate(local, [0, life], [0, shot.panX ?? 0]);

        // The shot that is fading in sits on top of the one that is finishing.
        const zIndex = local < FADE ? 2 : 1;

        return (
          <AbsoluteFill key={shot.src + i} style={{ opacity, zIndex, overflow: "hidden" }}>
            <Img
              src={staticFile(shot.src)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: shot.pos ?? "50% 50%",
                transform: `scale(${scale}) translateX(${tx}%)`,
              }}
            />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

export const MyComposition = () => {
  return (
    <>
      <Composition
        id="HeroDesktop"
        component={Montage}
        durationInFrames={loopLength(DESKTOP)}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ shots: DESKTOP }}
      />
      <Composition
        id="HeroMobile"
        component={Montage}
        durationInFrames={loopLength(MOBILE)}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ shots: MOBILE }}
      />
    </>
  );
};
