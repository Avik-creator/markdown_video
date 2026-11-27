"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  Clock,
  Code,
  ImageIcon,
  Layers,
  MousePointerClick,
  Palette,
  RotateCcw,
  Smartphone,
  Sparkles,
  Terminal,
  Type,
} from "lucide-react";
import {
  inspectSceneDirective,
  type DirectiveEditableScalar,
  type DirectiveValueSchema,
  type InspectedDirectiveValue,
  type Scene,
  type SceneDirectiveInspection,
  type SceneType,
} from "@markdown-video/core";
import { useVideoStore } from "@/lib/use-video-store";
import { applyDirectiveEditInEditor } from "@/lib/editor/apply-directive-edit";
import { Label } from "@components/ui/label";
import { cn } from "@/lib/utils";

const SCENE_TYPE_TO_DIRECTIVE: Partial<Record<SceneType, string>> = {
  text: "text",
  code: "code",
  image: "image",
  split: "layout",
  terminal: "terminal",
  diff: "diff",
  chart: "chart",
  mockup: "mockup",
  qr: "qr",
  countdown: "countdown",
  progress: "progress",
  emoji: "emoji",
};


// Positional scene metadata directives use their required first token to mean
// "this directive exists". The core rewrite engine therefore treats clearing
// that token as removing the whole metadata directive, unlike content-bearing
// positional directives where removal would eat user content.
const REMOVABLE_REQUIRED_POSITIONAL_DIRECTIVES = new Set([
  "duration",
  "background",
  "transition",
  "chapter",
  "locale",
]);

const TYPE_ICONS: Record<string, typeof Layers> = {
  text: Type,
  code: Code,
  image: ImageIcon,
  video: Layers,
  split: Layers,
  terminal: Terminal,
  chart: BarChart3,
  mockup: Smartphone,
  diff: Code,
};

function titleCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());
}

function numericDraft(rawValue: string | undefined): string {
  if (!rawValue) return "";
  return rawValue.replace(/s$/i, "");
}

function hexForColorInput(value: string | undefined): string | null {
  if (!value) return null;
  const hex = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return null;
}

function validateNumberDraft(
  draft: string,
  schema: DirectiveValueSchema
): { value?: number; error?: string } {
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(draft.trim())) {
    return { error: "Enter a number" };
  }
  const value = Number.parseFloat(draft);
  if (!Number.isFinite(value)) return { error: "Enter a finite number" };
  if (schema.min !== undefined) {
    const invalid = schema.exclusiveMin ? value <= schema.min : value < schema.min;
    if (invalid) {
      return {
        error: `Must be ${schema.exclusiveMin ? "greater than" : "at least"} ${schema.min}`,
      };
    }
  }
  if (schema.max !== undefined && value > schema.max) {
    return { error: `Must be at most ${schema.max}` };
  }
  // The editor UI additionally keeps scene durations in a sane authoring
  // range. The document schema intentionally remains permissive for CLI users.
  if (schema.name === "seconds" && schema.unit === "seconds" && value > 600) {
    return { error: "Scene duration must be at most 600 seconds" };
  }
  return { value };
}

function controlValueText(inspection: InspectedDirectiveValue): string {
  if (!inspection.present || inspection.rawValue === undefined) return "";
  return inspection.schema.type === "number"
    ? numericDraft(inspection.rawValue)
    : inspection.rawValue;
}

interface ControlShellProps {
  label: string;
  accessibilityLabel: string;
  inspection: InspectedDirectiveValue;
  onJump: (line?: number) => void;
  onClear?: () => void;
  children: ReactNode;
  error?: string;
  hint?: string;
}

function ControlShell({
  label,
  accessibilityLabel,
  inspection,
  onJump,
  onClear,
  children,
  error,
  hint,
}: ControlShellProps) {
  return (
    <div className="space-y-1.5" data-property-control={label}>
      <div className="flex items-center gap-1.5">
        <Label className="flex-1 text-xs font-medium text-gray-600 dark:text-neutral-400">
          {label}
        </Label>
        {inspection.line && (
          <button
            type="button"
            aria-label={`Jump to ${accessibilityLabel} in markdown source`}
            title={`Jump to line ${inspection.line}`}
            onClick={() => onJump(inspection.line)}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-pink-50 hover:text-pink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 dark:text-neutral-500 dark:hover:bg-pink-950/40 dark:hover:text-pink-400"
          >
            <MousePointerClick className="h-3.5 w-3.5" />
          </button>
        )}
        {inspection.present && onClear && (
          <button
            type="button"
            aria-label={`Reset ${accessibilityLabel} to default`}
            title="Remove the explicit value"
            onClick={onClear}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-gray-400 dark:text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}

interface ValueControlProps {
  directive: string;
  inspection: InspectedDirectiveValue;
  onCommit: (
    directive: string,
    valueName: string,
    value: DirectiveEditableScalar | null,
    kind: "property" | "positional"
  ) => boolean;
  onJump: (line?: number) => void;
  disabledReason?: string;
}

function ValueControl({
  directive,
  inspection,
  onCommit,
  onJump,
  disabledReason,
}: ValueControlProps) {
  const schema = inspection.schema;
  const label = titleCase(schema.name);
  const accessibilityLabel = `${titleCase(directive)} ${label}`;
  const [draft, setDraft] = useState(() => controlValueText(inspection));
  const [focused, setFocused] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const commit = useCallback(
    (value: DirectiveEditableScalar | null) =>
      onCommit(directive, inspection.name, value, inspection.kind),
    [directive, inspection.kind, inspection.name, onCommit]
  );
  const clear = useCallback(() => {
    setDraft("");
    setDraftError(null);
    commit(null);
  }, [commit]);

  const disabled = Boolean(disabledReason);
  const inputClass = cn(
    "w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 shadow-sm outline-none transition-colors",
    "placeholder:text-gray-400 focus:border-pink-400 focus:ring-2 focus:ring-pink-100",
    "dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-pink-700 dark:focus:ring-pink-950/60",
    disabled && "cursor-not-allowed opacity-55"
  );

  if (schema.type === "array" || schema.type === "object") {
    return (
      <ControlShell label={label} accessibilityLabel={accessibilityLabel} inspection={inspection} onJump={onJump}>
        <div className="rounded-md border border-dashed border-gray-200 px-2.5 py-2 text-xs text-gray-500 dark:border-neutral-800 dark:text-neutral-400">
          Structured value — edit in markdown
        </div>
      </ControlShell>
    );
  }

  if (schema.type === "enum") {
    const options = schema.values ?? [];
    const raw = inspection.present ? String(inspection.value ?? inspection.rawValue ?? "") : "";
    const selectValue = inspection.present && raw ? raw : "__default";
    return (
      <ControlShell label={label} accessibilityLabel={accessibilityLabel} inspection={inspection} onJump={onJump} onClear={clear}>
        <select
          aria-label={accessibilityLabel}
          value={selectValue}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value;
            commit(next === "__default" ? null : next);
          }}
          className={inputClass}
        >
          <option value="__default">
            Default{schema.default !== undefined ? ` (${String(schema.default)})` : ""}
          </option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          {inspection.present && !options.includes(raw) && raw && (
            <option value={raw}>{raw} (invalid)</option>
          )}
        </select>
        {disabledReason && <p className="mt-1 text-xs text-gray-400 dark:text-neutral-500">{disabledReason}</p>}
      </ControlShell>
    );
  }

  if (schema.type === "boolean") {
    const effective =
      typeof inspection.value === "boolean"
        ? inspection.value
        : typeof schema.default === "boolean"
          ? schema.default
          : false;
    return (
      <ControlShell label={label} accessibilityLabel={accessibilityLabel} inspection={inspection} onJump={onJump} onClear={clear}>
        <label className="flex min-h-9 cursor-pointer items-center justify-between rounded-md border border-gray-200 bg-white px-2.5 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
          <span className="text-sm text-gray-700 dark:text-neutral-300">
            {effective ? "Enabled" : "Disabled"}
            {!inspection.present && (
              <span className="ml-2 text-xs text-gray-400 dark:text-neutral-500">default</span>
            )}
          </span>
          <input
            type="checkbox"
            aria-label={accessibilityLabel}
            checked={effective}
            disabled={disabled}
            onChange={(event) => commit(event.target.checked)}
            className="h-4 w-4 accent-pink-500"
          />
        </label>
      </ControlShell>
    );
  }

  if (schema.type === "number") {
    const external = controlValueText(inspection);
    const shown = focused ? draft : external;
    return (
      <ControlShell
        label={label}
        accessibilityLabel={accessibilityLabel}
        inspection={inspection}
        onJump={onJump}
        onClear={clear}
        error={focused ? draftError ?? undefined : undefined}
        hint={!focused && !inspection.present && schema.default !== undefined ? `Default: ${schema.default}` : undefined}
      >
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            aria-label={accessibilityLabel}
            value={shown}
            disabled={disabled}
            min={schema.min}
            max={schema.max}
            step={schema.unit === "seconds" ? 0.1 : 1}
            placeholder={schema.default !== undefined ? String(schema.default) : ""}
            onFocus={() => {
              setFocused(true);
              setDraft(external);
              setDraftError(null);
            }}
            onBlur={() => {
              if (!disabled && draft.trim() === "" && !schema.required) {
                commit(null);
              }
              setFocused(false);
              setDraftError(null);
            }}
            onChange={(event) => {
              const next = event.target.value;
              setDraft(next);
              if (disabled || next.trim() === "") {
                setDraftError(null);
                return;
              }
              const parsed = validateNumberDraft(next, schema);
              if (parsed.error || parsed.value === undefined) {
                setDraftError(parsed.error ?? "Invalid number");
                return;
              }
              setDraftError(null);
              commit(parsed.value);
            }}
            className={cn(inputClass, schema.unit === "seconds" && "pr-8")}
          />
          {schema.unit === "seconds" && (
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-neutral-500">
              s
            </span>
          )}
        </div>
        {disabledReason && <p className="mt-1 text-xs text-gray-400 dark:text-neutral-500">{disabledReason}</p>}
      </ControlShell>
    );
  }

  // string/color/url share the same validated single-line text control; color
  // additionally gets a native swatch when the authored value is hex.
  const external = controlValueText(inspection);
  const shown = focused ? draft : external;
  const hex = schema.type === "color" ? hexForColorInput(shown) : null;
  return (
    <ControlShell
      label={label}
      accessibilityLabel={accessibilityLabel}
      inspection={inspection}
      onJump={onJump}
      onClear={schema.required && !(inspection.kind === "positional" && REMOVABLE_REQUIRED_POSITIONAL_DIRECTIVES.has(directive)) ? undefined : clear}
      error={focused ? draftError ?? undefined : undefined}
      hint={!focused && !inspection.present && schema.default !== undefined ? `Default: ${schema.default}` : undefined}
    >
      <div className="flex items-center gap-2">
        {schema.type === "color" && (
          <input
            type="color"
            aria-label={`${accessibilityLabel} picker`}
            value={hex ?? "#000000"}
            disabled={disabled || (!hex && shown.trim() !== "")}
            onChange={(event) => {
              setDraft(event.target.value);
              commit(event.target.value);
            }}
            className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-gray-200 bg-white p-1 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-800 dark:bg-neutral-900"
          />
        )}
        <input
          type="text"
          aria-label={accessibilityLabel}
          value={shown}
          disabled={disabled}
          placeholder={schema.default !== undefined ? String(schema.default) : schema.description}
          onFocus={() => {
            setFocused(true);
            setDraft(external);
            setDraftError(null);
          }}
          onBlur={() => {
            if (!disabled && shown.trim() === "" && !schema.required) {
              commit(null);
            }
            setFocused(false);
            setDraftError(null);
          }}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            if (disabled) return;
            if (next.trim() === "") {
              setDraftError(null);
              return;
            }
            if (/[\r\n]/.test(next)) {
              setDraftError("Value must stay on one line");
              return;
            }
            setDraftError(null);
            commit(next);
          }}
          className={inputClass}
        />
      </div>
      {disabledReason && <p className="mt-1 text-xs text-gray-400 dark:text-neutral-500">{disabledReason}</p>}
    </ControlShell>
  );
}

function inspectionValue(
  inspection: SceneDirectiveInspection | null,
  kind: "property" | "positional",
  name: string
): InspectedDirectiveValue | undefined {
  return (kind === "property" ? inspection?.properties : inspection?.positional)?.find(
    (value) => value.name === name
  );
}

function useCurrentSceneSelection() {
  const scenes = useVideoStore((state) => state.scenes);
  const currentTime = useVideoStore((state) => state.currentTime);
  // This scan is tiny (one number per scene), and keeping it unmemoized lets
  // the React Compiler own render optimization instead of fighting a manual
  // object-shaped useMemo.
  let accumulated = 0;
  for (let index = 0; index < scenes.length; index++) {
    if (currentTime >= accumulated && currentTime < accumulated + scenes[index].duration) {
      return { scene: scenes[index], sceneIndex: index };
    }
    accumulated += scenes[index].duration;
  }
  const fallbackIndex = Math.max(0, scenes.length - 1);
  return scenes.length > 0
    ? { scene: scenes[fallbackIndex], sceneIndex: fallbackIndex }
    : { scene: null, sceneIndex: -1 };
}

function EditableSceneProperties({ scene, sceneIndex }: { scene: Scene; sceneIndex: number }) {
  const markdown = useVideoStore((state) => state.markdown);
  const scenes = useVideoStore((state) => state.scenes);
  const setHighlightRange = useVideoStore((state) => state.setHighlightRange);

  const contentDirective = SCENE_TYPE_TO_DIRECTIVE[scene.type];
  const inspections = useMemo(
    () => ({
      duration: inspectSceneDirective(markdown, sceneIndex, "duration"),
      background: inspectSceneDirective(markdown, sceneIndex, "background"),
      transition: inspectSceneDirective(markdown, sceneIndex, "transition"),
      chapter: inspectSceneDirective(markdown, sceneIndex, "chapter"),
      locale: inspectSceneDirective(markdown, sceneIndex, "locale"),
      content: contentDirective
        ? inspectSceneDirective(markdown, sceneIndex, contentDirective)
        : null,
      particles: inspectSceneDirective(markdown, sceneIndex, "particles"),
      presenter: inspectSceneDirective(markdown, sceneIndex, "presenter"),
      callout: inspectSceneDirective(markdown, sceneIndex, "callout"),
    }),
    [markdown, sceneIndex, contentDirective]
  );

  const commit = useCallback(
    (
      directive: string,
      valueName: string,
      value: DirectiveEditableScalar | null,
      kind: "property" | "positional"
    ) => {
      return applyDirectiveEditInEditor({
        sceneIndex,
        directive,
        valueName,
        value,
        kind,
      }).ok;
    },
    [sceneIndex]
  );

  const jump = useCallback(
    (line?: number) => {
      if (!line) return;
      setHighlightRange({ startLine: line, endLine: line });
    },
    [setHighlightRange]
  );

  const TypeIcon = TYPE_ICONS[scene.type] || Layers;
  const contentSchema = inspections.content;
  const transitionPresent = inspections.transition?.present === true;
  const effectInspections = [inspections.particles, inspections.presenter, inspections.callout].filter(
    (inspection): inspection is SceneDirectiveInspection => Boolean(inspection?.present)
  );

  return (
    <aside className="flex h-full w-80 flex-col border-l border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="shrink-0 border-b border-gray-200 p-4 dark:border-neutral-800">
        <h3 className="text-sm font-medium text-gray-900 dark:text-neutral-100">Scene Properties</h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-neutral-400">
          <MousePointerClick className="h-3 w-3 text-pink-500 dark:text-pink-400" />
          Edits write markdown directly
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        <section className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5 dark:border-neutral-800 dark:bg-neutral-900/70">
            <TypeIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium capitalize text-gray-900 dark:text-neutral-100">
                {scene.type} scene
              </div>
              <div className="text-xs text-gray-500 dark:text-neutral-400">
                Scene {sceneIndex + 1} of {scenes.length}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-400">
              <Clock className="h-3.5 w-3.5" /> Scene
            </div>
            {inspectionValue(inspections.duration, "positional", "seconds") && (
              <ValueControl
                directive="duration"
                inspection={inspectionValue(inspections.duration, "positional", "seconds")!}
                onCommit={commit}
                onJump={jump}
              />
            )}
            {inspectionValue(inspections.background, "positional", "color") && (
              <ValueControl
                directive="background"
                inspection={inspectionValue(inspections.background, "positional", "color")!}
                onCommit={commit}
                onJump={jump}
              />
            )}
            {inspectionValue(inspections.transition, "positional", "type") && (
              <ValueControl
                directive="transition"
                inspection={inspectionValue(inspections.transition, "positional", "type")!}
                onCommit={commit}
                onJump={jump}
              />
            )}
            {inspectionValue(inspections.transition, "positional", "duration") && (
              <ValueControl
                directive="transition"
                inspection={inspectionValue(inspections.transition, "positional", "duration")!}
                onCommit={commit}
                onJump={jump}
                disabledReason={transitionPresent ? undefined : "Set a transition type first"}
              />
            )}
            {inspectionValue(inspections.chapter, "positional", "title") && (
              <ValueControl
                directive="chapter"
                inspection={inspectionValue(inspections.chapter, "positional", "title")!}
                onCommit={commit}
                onJump={jump}
              />
            )}
            {inspectionValue(inspections.locale, "positional", "code") && (
              <ValueControl
                directive="locale"
                inspection={inspectionValue(inspections.locale, "positional", "code")!}
                onCommit={commit}
                onJump={jump}
              />
            )}
          </div>
        </section>

        {contentSchema && (
          <section className="space-y-4 border-t border-gray-200 pt-4 dark:border-neutral-800">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-400">
              <Palette className="h-3.5 w-3.5" /> {titleCase(contentSchema.directiveName)} settings
            </div>
            {contentSchema.positional.map((inspection) => (
              <ValueControl
                key={`positional-${inspection.name}`}
                directive={contentSchema.directiveName}
                inspection={inspection}
                onCommit={commit}
                onJump={jump}
              />
            ))}
            {contentSchema.properties.map((inspection) => (
              <ValueControl
                key={`property-${inspection.name}`}
                directive={contentSchema.directiveName}
                inspection={inspection}
                onCommit={commit}
                onJump={jump}
              />
            ))}
            {scene.type === "split" && (
              <p className="rounded-md bg-blue-50 px-2.5 py-2 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                Nested split-panel content remains markdown-edited; scene-level layout properties are editable here.
              </p>
            )}
          </section>
        )}

        {effectInspections.length > 0 && (
          <section className="space-y-4 border-t border-gray-200 pt-4 dark:border-neutral-800">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-400">
              <Sparkles className="h-3.5 w-3.5" /> Effects
            </div>
            {effectInspections.map((effect) => (
              <div key={effect.directiveName} className="space-y-4 rounded-lg border border-gray-100 p-3 dark:border-neutral-900">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-500">
                  {titleCase(effect.directiveName)}
                </div>
                {effect.positional.map((inspection) => (
                  <ValueControl
                    key={`${effect.directiveName}-positional-${inspection.name}`}
                    directive={effect.directiveName}
                    inspection={inspection}
                    onCommit={commit}
                    onJump={jump}
                  />
                ))}
                {effect.properties.map((inspection) => (
                  <ValueControl
                    key={`${effect.directiveName}-property-${inspection.name}`}
                    directive={effect.directiveName}
                    inspection={inspection}
                    onCommit={commit}
                    onJump={jump}
                  />
                ))}
              </div>
            ))}
            {scene.camera && (
              <p className="rounded-md border border-dashed border-gray-200 px-2.5 py-2 text-xs text-gray-500 dark:border-neutral-800 dark:text-neutral-400">
                Camera keyframes are shown in markdown; simple camera editing is not enabled yet.
              </p>
            )}
          </section>
        )}
      </div>

      <div className="shrink-0 border-t border-gray-200 p-4 dark:border-neutral-800">
        <p className="text-xs text-gray-500 dark:text-neutral-400">
          {scenes.length} scene{scenes.length !== 1 ? "s" : ""} total · markdown remains the source of truth
        </p>
      </div>
    </aside>
  );
}

export function SceneProperties() {
  const { scene, sceneIndex } = useCurrentSceneSelection();

  if (!scene) {
    return (
      <aside className="w-80 border-l border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <h3 className="mb-4 text-sm font-medium text-gray-900 dark:text-neutral-100">
          Scene Properties
        </h3>
        <p className="text-sm text-gray-500 dark:text-neutral-400">No scene selected</p>
      </aside>
    );
  }

  return <EditableSceneProperties key={`${sceneIndex}-${scene.type}`} scene={scene} sceneIndex={sceneIndex} />;
}
