"use client";

import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";
import type { Scene } from "@/lib/types";

export function ChartScene({
  scene,
  sceneTime,
}: {
  scene: Scene;
  sceneTime?: number;
}) {
  const chart = scene.chart;
  const controls = useAnimation();

  useEffect(() => {
    if (sceneTime !== undefined) {
      const duration = 0.5;
      const progress = Math.min(sceneTime / duration, 1);
      controls.set({ opacity: progress });
    } else {
      controls.start({ opacity: 1 });
    }
  }, [sceneTime, controls]);

  if (!chart) return null;

  const maxValue = Math.max(...chart.data.map((d) => d.value));
  const colors = [
    "#3b82f6",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#f97316",
  ];

  return (
    <motion.div
      className="flex items-center justify-center h-full p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="bg-[#1a1a24] rounded-xl p-6 w-full max-w-2xl shadow-2xl border border-white/10">
        {chart.title && (
          <h3 className="text-lg font-semibold text-white mb-6 text-center">
            {chart.title}
          </h3>
        )}

        {chart.type === "bar" && (
          <div className="space-y-4">
            {chart.data.map((item, index) => (
              <div key={index} className="flex items-center gap-4">
                <span className="text-gray-300 w-24 text-sm truncate">
                  {item.label}
                </span>
                <div className="flex-1 h-8 bg-[#0f0f14] rounded-lg overflow-hidden">
                  <motion.div
                    className="h-full rounded-lg flex items-center justify-end pr-2"
                    style={{
                      backgroundColor:
                        item.color || colors[index % colors.length],
                    }}
                    initial={{ width: 0 }}
                    animate={
                      sceneTime !== undefined
                        ? {
                            width: `${
                              Math.min(
                                1,
                                Math.max(0, (sceneTime - index * 0.1) / 0.8)
                              ) *
                              (item.value / maxValue) *
                              100
                            }%`,
                          }
                        : {
                            width: `${(item.value / maxValue) * 100}%`,
                          }
                    }
                    transition={
                      sceneTime !== undefined
                        ? { duration: 0 }
                        : { duration: 0.8, delay: index * 0.1, ease: "easeOut" }
                    }
                  >
                    <span className="text-white text-sm font-medium">
                      {item.value}
                    </span>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(chart.type === "pie" || chart.type === "donut") && (
          <div className="flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-64 h-64">
              {chart.data.map((item, index) => {
                const total = chart.data.reduce((sum, d) => sum + d.value, 0);
                const startAngle = chart.data
                  .slice(0, index)
                  .reduce((sum, d) => sum + (d.value / total) * 360, 0);
                const angle = (item.value / total) * 360;

                const x1 =
                  50 + 40 * Math.cos((Math.PI * (startAngle - 90)) / 180);
                const y1 =
                  50 + 40 * Math.sin((Math.PI * (startAngle - 90)) / 180);
                const x2 =
                  50 +
                  40 * Math.cos((Math.PI * (startAngle + angle - 90)) / 180);
                const y2 =
                  50 +
                  40 * Math.sin((Math.PI * (startAngle + angle - 90)) / 180);
                const largeArc = angle > 180 ? 1 : 0;

                return (
                  <motion.path
                    key={index}
                    d={
                      chart.type === "donut"
                        ? `M ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2}`
                        : `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`
                    }
                    fill={
                      chart.type === "donut"
                        ? "none"
                        : item.color || colors[index % colors.length]
                    }
                    stroke={item.color || colors[index % colors.length]}
                    strokeWidth={chart.type === "donut" ? 12 : 0}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={
                      sceneTime !== undefined
                        ? {
                            pathLength: Math.min(
                              1,
                              Math.max(0, (sceneTime - index * 0.15) / 0.5)
                            ),
                            opacity: sceneTime >= index * 0.15 ? 1 : 0,
                          }
                        : {
                            pathLength: 1,
                            opacity: 1,
                          }
                    }
                    transition={
                      sceneTime !== undefined
                        ? { duration: 0 }
                        : { duration: 0.5, delay: index * 0.15 }
                    }
                  />
                );
              })}
            </svg>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 mt-6">
          {chart.data.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: item.color || colors[index % colors.length],
                }}
              />
              <span className="text-gray-400 text-sm">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
