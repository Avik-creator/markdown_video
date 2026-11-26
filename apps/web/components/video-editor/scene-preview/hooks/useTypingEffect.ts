import { useState, useEffect, useMemo } from "react";

export function useTypingEffect(
  text: string,
  speed = 50,
  enabled = true,
  sceneTime?: number
) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  // If sceneTime is provided, use it for deterministic typing (useful for export)
  const deterministicText = useMemo(() => {
    if (!enabled) return text;
    if (sceneTime === undefined) return null;

    const charsToShow = Math.floor(sceneTime * speed);
    return text.slice(0, charsToShow);
  }, [text, speed, enabled, sceneTime]);

  useEffect(() => {
    if (!enabled || sceneTime !== undefined) {
      if (sceneTime !== undefined) {
        setDisplayedText(deterministicText || "");
        setIsComplete((deterministicText?.length || 0) >= text.length);
      } else {
        setDisplayedText(text);
        setIsComplete(true);
      }
      return;
    }

    setDisplayedText("");
    setIsComplete(false);
    let index = 0;

    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, 1000 / speed);

    return () => clearInterval(interval);
  }, [text, speed, enabled, sceneTime, deterministicText]);

  return {
    displayedText:
      sceneTime !== undefined ? deterministicText || "" : displayedText,
    isComplete,
  };
}
