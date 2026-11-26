import { Navbar } from "@components/landing/navbar"
import { Hero } from "@components/landing/hero"
import { Features } from "@components/landing/features"
import { SyntaxDemo } from "@components/landing/syntax-demo"
import { CTA } from "@components/landing/cta"
import { Footer } from "@components/landing/footer"
import { getGitHubStars } from "@/lib/github"

export default async function Page() {
  const stargazersCount = await getGitHubStars("Avik-creator/markdown_video")

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-gray-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none focus:ring-2 focus:ring-pink-500 dark:focus:bg-neutral-100 dark:focus:text-neutral-900"
      >
        Skip to content
      </a>
      <Navbar stargazersCount={stargazersCount} />
      <main id="main-content" className="scroll-mt-14">
        <Hero />
        <Features />
        <SyntaxDemo />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
