"use client";

import { useState, useEffect, useMemo } from "react";

export function ParticleEffect({
  type,
  intensity = "medium",
  sceneTime = 0,
}: {
  type: string;
  intensity?: "low" | "medium" | "high";
  sceneTime?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const count = { low: 20, medium: 50, high: 100 }[intensity];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Pseudo-random function based on index
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const x = seededRandom(i + 1) * 100;
      const delay = seededRandom(i + 2) * 2;
      const duration = 2 + seededRandom(i + 3) * 3;
      const size = 4 + seededRandom(i + 4) * 8;
      const colorIdx = Math.floor(seededRandom(i + 5) * 6);
      const top = 20 + seededRandom(i + 6) * 60;

      return { id: i, x, delay, duration, size, colorIdx, top };
    });
  }, [count]);

  if (!mounted) return null;

  if (type === "confetti") {
    const colors = [
      "#f43f5e",
      "#3b82f6",
      "#22c55e",
      "#eab308",
      "#8b5cf6",
      "#ec4899",
    ];
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => {
          const particleTime = (sceneTime + p.delay) % p.duration;
          const progress = particleTime / p.duration;

          const y = -20 + progress * 140; // From -20 to 120vh
          const rotate = progress * 360 * (p.id % 2 === 0 ? 1 : -1);
          const opacity = progress < 0.8 ? 1 : 1 - (progress - 0.8) / 0.2;

          return (
            <div
              key={p.id}
              className="absolute"
              style={{
                left: `${p.x}%`,
                top: `${y}%`,
                width: p.size,
                height: p.size * 0.6,
                backgroundColor: colors[p.colorIdx],
                borderRadius: 2,
                transform: `rotate(${rotate}deg)`,
                opacity,
              }}
            />
          );
        })}
      </div>
    );
  }

  if (type === "snow") {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => {
          const particleTime = (sceneTime + p.delay) % (p.duration * 2);
          const progress = particleTime / (p.duration * 2);

          const y = -10 + progress * 130;
          const xOffset = Math.sin(sceneTime + p.id) * 5;
          const opacity =
            progress < 0.1
              ? progress / 0.1
              : progress > 0.9
              ? 1 - (progress - 0.9) / 0.1
              : 1;

          return (
            <div
              key={p.id}
              className="absolute rounded-full bg-white"
              style={{
                left: `${p.x + xOffset}%`,
                top: `${y}%`,
                width: p.size / 2,
                height: p.size / 2,
                opacity: opacity * 0.6,
                filter: "blur(1px)",
              }}
            />
          );
        })}
      </div>
    );
  }

  if (type === "sparkles") {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => {
          const particleTime = (sceneTime + p.delay) % 1.5;
          const progress = particleTime / 1.5;

          const scale = Math.sin(progress * Math.PI);
          const opacity = scale;

          return (
            <div
              key={p.id}
              className="absolute"
              style={{
                left: `${p.x}%`,
                top: `${p.top}%`,
                transform: `scale(${scale})`,
                opacity: opacity * 0.8,
              }}
            >
              <svg
                width={p.size * 2}
                height={p.size * 2}
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z"
                  fill="#fbbf24"
                />
              </svg>
            </div>
          );
        })}
      </div>
    );
  }

  if (type === "rain") {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => {
          const particleTime = (sceneTime + p.delay) % (p.duration * 0.5);
          const progress = particleTime / (p.duration * 0.5);

          const y = -20 + progress * 140;
          const opacity =
            progress < 0.8 ? 0.7 : 0.7 * (1 - (progress - 0.8) / 0.2);

          return (
            <div
              key={p.id}
              className="absolute bg-blue-400/60"
              style={{
                left: `${p.x}%`,
                top: `${y}%`,
                width: 2,
                height: p.size + 10,
                borderRadius: 2,
                opacity,
              }}
            />
          );
        })}
      </div>
    );
  }

  if (type === "fireworks") {
    const colors = [
      "#f43f5e",
      "#3b82f6",
      "#22c55e",
      "#eab308",
      "#8b5cf6",
      "#ec4899",
      "#06b6d4",
    ];
    const fireworkCount = Math.max(5, Math.floor(count / 5));
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: fireworkCount }).map((_, idx) => {
          const seed = idx + 1;
          const posX =
            15 + (idx * 70) / fireworkCount + seededRandom(seed) * 10;
          const posY = 20 + seededRandom(seed + 1) * 50;
          const delay = idx * 0.5 + seededRandom(seed + 2) * 0.5;
          const color = colors[idx % colors.length];

          const cycleTime = 3.5; // duration (1.5) + repeatDelay (2)
          const particleTime = (sceneTime + delay) % cycleTime;

          if (particleTime > 1.5) return null;

          const progress = particleTime / 1.5;
          const opacity = progress < 0.8 ? 1 : 1 - (progress - 0.8) / 0.2;
          const scale = progress < 0.2 ? progress / 0.2 : 1;

          return (
            <div
              key={idx}
              className="absolute"
              style={{
                left: `${posX}%`,
                top: `${posY}%`,
                transform: `scale(${scale})`,
                opacity,
              }}
            >
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i * Math.PI * 2) / 12;
                const burstProgress = Math.max(0, (particleTime - 0.1) / 1.4);
                const distance =
                  (30 + seededRandom(i + seed) * 20) * burstProgress;
                const pOpacity = 1 - burstProgress;
                const pScale = 1 - burstProgress * 0.5;

                return (
                  <div
                    key={i}
                    className="absolute"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: color,
                      boxShadow: `0 0 6px ${color}`,
                      left: -3,
                      top: -3,
                      transform: `translate(${Math.cos(angle) * distance}px, ${
                        Math.sin(angle) * distance
                      }px) scale(${pScale})`,
                      opacity: pOpacity,
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}
