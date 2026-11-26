"use client"

import { motion, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const reduceMotion = useReducedMotion()

  const classes = `min-w-0 ${className ?? ""}`

  if (reduceMotion) {
    return <div className={classes}>{children}</div>
  }

  return (
    <motion.div
      className={classes}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
