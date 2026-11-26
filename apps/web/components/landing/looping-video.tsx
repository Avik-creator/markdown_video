"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

type LoopingVideoProps = {
  src: string;
  poster: string;
  label: string;
  className?: string;
};

export function LoopingVideo({ src, poster, label, className }: LoopingVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (reduceMotion) {
      video.pause();
      return;
    }

    void video.play().catch(() => {
      // Autoplay can be unavailable in low-power or data-saving modes. The
      // poster remains a complete representation of the clip in that case.
    });
  }, [reduceMotion]);

  return (
    <video
      ref={videoRef}
      className={className}
      width={960}
      height={720}
      muted
      loop
      playsInline
      preload="metadata"
      poster={poster}
      aria-label={label}
    >
      <source src={src} type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  );
}
