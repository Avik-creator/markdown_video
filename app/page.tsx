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
    <main className="min-h-screen bg-white dark:bg-neutral-950">
      <Navbar stargazersCount={stargazersCount} />
      <Hero />
      <Features />
      <SyntaxDemo />
      <CTA />
      <Footer />
    </main>
  )
}

