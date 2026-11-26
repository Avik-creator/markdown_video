import "server-only";

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

export async function getGitHubStars(repo: string): Promise<number> {
  if (!REPO_PATTERN.test(repo)) {
    console.error("Invalid GitHub repo format:", repo);
    return 0;
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch GitHub stars:", response.statusText);
      return 0;
    }

    const data = await response.json();
    return data.stargazers_count || 0;
  } catch (error) {
    console.error("Error fetching GitHub stars:", error);
    return 0;
  }
}
