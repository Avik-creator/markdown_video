import { Navbar } from "@components/landing/navbar"
import { Hero } from "@components/landing/hero"
import { Features } from "@components/landing/features"
import { SyntaxDemo, TypeSpecimen } from "@components/landing/syntax-demo"
import { CTA } from "@components/landing/cta"
import { Footer } from "@components/landing/footer"
import { getGitHubStars } from "@/lib/github"

export default async function Page() {
  const stargazersCount = await getGitHubStars("Avik-creator/markdown_video")

  return (
    <div className="landing-paper min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[#171512] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[#f4f0e6] focus:outline-none focus:ring-2 focus:ring-[#a81645] focus:ring-offset-4 focus:ring-offset-[#f4f0e6]"
      >
        Skip to content
      </a>
      <Navbar stargazersCount={stargazersCount} />
      <main id="main-content" className="scroll-mt-16">
        <Hero />
        <Features />
        <TypeSpecimen />
        <SyntaxDemo />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
