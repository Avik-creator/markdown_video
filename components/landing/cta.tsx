"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export function CTA() {
  return (
    <section className="py-24 px-6 border-t border-zinc-800">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-4xl mx-auto text-center"
      >
        <div className="relative rounded-2xl overflow-hidden p-12 md:p-20 bg-zinc-900 border border-zinc-800">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">Ready to create?</h2>
          <p className="text-lg text-zinc-400 mb-10 max-w-xl mx-auto">
            Start building stunning videos with just markdown. No account required, free to use.
          </p>
          <Button asChild size="lg" className="gap-2 bg-white text-black hover:bg-zinc-200 px-8">
            <Link href="/editor">
              Open Editor
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </motion.div>
    </section>
  )
}
