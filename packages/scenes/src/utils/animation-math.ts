/**
 * Pure, deterministic animation math for scene rendering.
 *
 * Every helper here is a pure function of scene time (and configuration), so
 * the preview and the exporter produce identical visual state at the same
 * scene time — unlike framer-motion springs/tweens, which evolve on
 * wall-clock time and therefore depend on how fast frames are captured.
 */

export interface SpringParams {
  stiffness: number;
  damping: number;
  mass?: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Analytic step response of a damped harmonic oscillator — the same physics
 * framer-motion uses for `type: "spring"` — evaluated at time `t` (seconds).
 *
 * The spring starts at rest at 0 and moves toward 1. Underdamped springs
 * overshoot past 1 before settling (the "bounce"), matching what the
 * wall-clock spring would have rendered frame by frame.
 */
export function springProgress(t: number, params: SpringParams): number {
  if (t <= 0) {
    return 0;
  }

  const mass = params.mass ?? 1;
  const { stiffness, damping } = params;
  if (stiffness <= 0 || mass <= 0) {
    return 1;
  }

  const omega0 = Math.sqrt(stiffness / mass); // natural frequency
  const zeta = damping / (2 * Math.sqrt(stiffness * mass)); // damping ratio

  if (zeta < 1) {
    // Underdamped: oscillates into place with overshoot.
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const envelope = Math.exp(-zeta * omega0 * t);
    return (
      1 -
      envelope *
        (Math.cos(omegaD * t) +
          ((zeta * omega0) / omegaD) * Math.sin(omegaD * t))
    );
  }

  if (zeta === 1) {
    // Critically damped.
    return 1 - Math.exp(-omega0 * t) * (1 + omega0 * t);
  }

  // Overdamped: two real roots, no overshoot.
  const discriminant = omega0 * Math.sqrt(zeta * zeta - 1);
  const r1 = -zeta * omega0 + discriminant;
  const r2 = -zeta * omega0 - discriminant;
  return (
    1 +
    (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r1 - r2)
  );
}

export interface CountdownDigitState {
  /** The number currently displayed by the countdown. */
  remainingTime: number;
  /** Seconds since the currently displayed digit appeared. */
  timeSinceAppear: number;
}

/**
 * Countdown digit state derived purely from scene time.
 *
 * The displayed value decreases by one each second and stops at 0. Each new
 * digit "pops" in when it appears; once the count reaches 0 the digit no
 * longer changes, so the pop clock must keep running instead of restarting
 * every second.
 */
export function countdownDigitState(
  sceneTime: number,
  from: number
): CountdownDigitState {
  const remainingTime = Math.max(0, from - Math.floor(sceneTime));
  // The current digit appeared when floor(sceneTime) last changed — except
  // once the count has bottomed out at 0, in which case the zero digit has
  // been on screen since t = ceil(from).
  const appearedAt = Math.min(Math.floor(sceneTime), Math.ceil(from));
  return {
    remainingTime,
    timeSinceAppear: Math.max(0, sceneTime - appearedAt),
  };
}

export interface TerminalCommandInput {
  command: string;
  output?: string;
}

export interface TerminalCommandState {
  /** Whether the command row should render at all. */
  started: boolean;
  /** How many characters of the command text are visible. */
  commandChars: number;
  /** Whether the typing cursor shows after the command text. */
  typing: boolean;
  /** Whether the output block is visible. */
  outputVisible: boolean;
  /** Opacity of the output block (deterministic fade-in). */
  outputOpacity: number;
}

/** Seconds of delay before output starts fading in (matches the original). */
export const TERMINAL_OUTPUT_FADE_DELAY = 0.2;
/** Seconds the output fade takes (framer-motion's default tween duration). */
export const TERMINAL_OUTPUT_FADE_DURATION = 0.3;

/**
 * Reproduce the terminal typing timeline as a pure function of scene time.
 *
 * Each command occupies a window of `command + output + 20` characters at
 * `charsPerSecond` characters per second. The command text types out over the
 * first half of its window; the output appears once the window is past its
 * midpoint and fades in after a short delay.
 */
export function computeTerminalCommandStates(
  commands: TerminalCommandInput[],
  sceneTime: number,
  charsPerSecond: number,
  typing: boolean
): TerminalCommandState[] {
  if (!typing) {
    return commands.map((cmd) => {
      const hasOutput = Boolean(cmd.output);
      return {
        started: true,
        commandChars: cmd.command.length,
        typing: false,
        outputVisible: hasOutput,
        outputOpacity: hasOutput
          ? clamp01(
              (sceneTime - TERMINAL_OUTPUT_FADE_DELAY) /
                TERMINAL_OUTPUT_FADE_DURATION
            )
          : 0,
      };
    });
  }

  const charsSoFar = sceneTime * charsPerSecond;
  const states: TerminalCommandState[] = [];

  let offset = 0;
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const windowChars =
      cmd.command.length + (cmd.output?.length || 0) + 20;
    const rawProgress = (charsSoFar - offset) / windowChars;
    const progress = clamp01(rawProgress);
    const started = rawProgress >= 0;
    const commandLength = cmd.command.length;
    const hasOutput = Boolean(cmd.output);

    // The output appears once typing passes the window midpoint — the same
    // threshold the original wall-clock logic used.
    const outputVisible = hasOutput && progress > 0.5;
    const outputAppearTime = (offset + 0.5 * windowChars) / charsPerSecond;

    states.push({
      started,
      commandChars: started
        ? Math.min(commandLength, Math.floor(commandLength * progress * 2))
        : 0,
      typing: started && progress < 1,
      outputVisible,
      outputOpacity: outputVisible
        ? clamp01(
            (sceneTime - outputAppearTime - TERMINAL_OUTPUT_FADE_DELAY) /
              TERMINAL_OUTPUT_FADE_DURATION
          )
        : 0,
    });

    offset += windowChars;
  }

  return states;
}

/**
 * Progress (0..1) of a single line in a staggered text reveal, mirroring
 * framer-motion's `staggerChildren`/`delayChildren` orchestration as a pure
 * function of scene time.
 */
export function staggeredLineProgress(
  sceneTime: number,
  lineIndex: number,
  stagger: number,
  delayChildren = 0.1,
  duration = 0.5
): number {
  const start = delayChildren + lineIndex * stagger;
  return clamp01((sceneTime - start) / duration);
}

/**
 * Deterministic equivalent of Tailwind's `animate-pulse` opacity curve for
 * typing cursors. The class-based animation runs on wall-clock time, which
 * makes exported frames depend on capture speed; this triangular wave keeps
 * the same visual pulse endpoints (1 → 0.5 → 1 over two seconds) as a pure
 * function of scene time.
 */
export function pulseOpacityAtTime(
  sceneTime: number,
  duration = 2,
  minimumOpacity = 0.5
): number {
  if (
    typeof sceneTime !== "number" ||
    !Number.isFinite(sceneTime) ||
    typeof duration !== "number" ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return 1;
  }

  const clampedMinimum = clamp01(minimumOpacity);
  const cycleTime = ((sceneTime % duration) + duration) % duration;
  const phase = cycleTime / duration;
  const pulsePhase = phase <= 0.5 ? phase * 2 : (1 - phase) * 2;

  return 1 - (1 - clampedMinimum) * pulsePhase;
}
