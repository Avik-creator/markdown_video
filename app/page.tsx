import { Navbar } from "@components/landing/navbar"
import { Hero } from "@components/landing/hero"
import { Features } from "@components/landing/features"
import { SyntaxDemo } from "@components/landing/syntax-demo"
import { CTA } from "@components/landing/cta"
import { Footer } from "@components/landing/footer"

export default function Page() {
  return (
    <main className="min-h-screen bg-white dark:bg-neutral-950">
      <Navbar />
      <Hero />
      <Features />
      <SyntaxDemo />
      <CTA />
      <Footer />
    </main>
  )
}
