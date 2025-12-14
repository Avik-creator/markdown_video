"use client";

import { useState, useRef, useEffect } from "react";
import { useVideoStore } from "@/lib/use-video-store";
import { ChevronDown, Monitor, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import CornerMarkers from "@/components/CornerMarkers";

interface DropdownOption {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
}

function CustomDropdown({ label, icon, value, options, onChange }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="text-sm text-zinc-400 flex items-center gap-2 mb-2">
        {icon}
        {label}
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'group flex items-center justify-between gap-2 w-full',
          'relative transition-all duration-300 ease-out px-3 py-2.5',
          'hover:translate-x-[-2px]'
        )}
      >
        <CornerMarkers />
        <span className="text-sm font-serif font-semibold text-gray-900 dark:text-neutral-100 underline decoration-gray-500 dark:decoration-neutral-400/50 underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-gray-700 dark:group-hover:decoration-neutral-300">
          {selectedOption?.label}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-gray-900 dark:text-neutral-100 transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 z-50 animate-[slideFadeUp_0.2s_ease-out]">
          <div className="relative group bg-black">
            {/* Dot grid background pattern */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `radial-gradient(circle, rgba(255, 255, 255, 0.3) 1px, transparent 1px)`,
                backgroundSize: '20px 20px',
              }}
            />
            <CornerMarkers variant="static" />

            <div className="px-2 py-2 space-y-1 relative z-10">
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'group flex items-center gap-2 w-full',
                    'relative transition-all duration-300 ease-out px-3 py-2',
                    'hover:translate-x-[-2px]',
                    option.value === value && 'bg-zinc-800/50'
                  )}
                >
                  <span className="text-sm font-medium text-white underline decoration-white/50 underline-offset-4 transition-all duration-300 group-hover:underline-offset-[6px] group-hover:decoration-white relative z-10">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RenderOptions() {
  const exportSettings = useVideoStore((state) => state.exportSettings);
  const setExportSettings = useVideoStore((state) => state.setExportSettings);

  const resolutionOptions: DropdownOption[] = [
    { value: "480p", label: "480p (SD)" },
    { value: "720p", label: "720p (HD)" },
    { value: "1080p", label: "1080p (Full HD)" },
  ];

  const qualityOptions: DropdownOption[] = [
    { value: "low", label: "Low (Fastest)" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "ultra", label: "Ultra (Best)" },
  ];

  const speedOptions: DropdownOption[] = [
    { value: "fastest", label: "Fastest" },
    { value: "fast", label: "Fast" },
    { value: "balanced", label: "Balanced" },
    { value: "slow", label: "Slow" },
    { value: "slowest", label: "Slowest (Best)" },
  ];

  return (
    <div className="space-y-5 pb-4">
      <CustomDropdown
        label="Resolution"
        icon={<Monitor className="w-3.5 h-3.5" />}
        value={exportSettings.resolution}
        options={resolutionOptions}
        onChange={(value) => setExportSettings({ resolution: value })}
      />

      <CustomDropdown
        label="Quality"
        icon={<Sparkles className="w-3.5 h-3.5" />}
        value={exportSettings.quality}
        options={qualityOptions}
        onChange={(value) => setExportSettings({ quality: value })}
      />

      <CustomDropdown
        label="Processing Speed"
        icon={<Zap className="w-3.5 h-3.5" />}
        value={exportSettings.speed}
        options={speedOptions}
        onChange={(value) => setExportSettings({ speed: value })}
      />
    </div>
  );
}
