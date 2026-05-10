export interface GitHubRepo {
  name: string;
  fullName: string;
  updatedAt: string;
  isPrivate: boolean;
  description: string | null;
  language: string | null;
}

export async function fetchUserRepos(token: string): Promise<GitHubRepo[]> {
  const res = await fetch(
    "https://api.github.com/user/repos?sort=updated&per_page=50&type=all",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const repos = await res.json();

  return repos.map((repo: {
    name: string;
    full_name: string;
    updated_at: string;
    private: boolean;
    description: string | null;
    language: string | null;
  }) => ({
    name: repo.name,
    fullName: repo.full_name,
    updatedAt: repo.updated_at,
    isPrivate: repo.private,
    description: repo.description,
    language: repo.language,
  }));
}
