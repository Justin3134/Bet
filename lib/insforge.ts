import { createClient } from "@insforge/sdk";

const INSFORGE_URL =
  process.env.NEXT_PUBLIC_INSFORGE_URL || "https://4vxtn8fe.us-east.insforge.app";
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || "";

// Browser-side client (uses anon key, or attaches user token after login)
export const insforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY,
});

export type InsforgeUser = {
  id: string;
  insforge_user_id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  github_connected: boolean;
  github_username: string | null;
  github_access_token: string | null;
  hit_rate: number;
  hits_count: number;
  misses_count: number;
  current_streak: number;
  total_bets: number;
  created_at: string;
};

export type NiaTask = {
  title: string;
  description: string;
  task_type: "github" | "email";
};

export type NiaVcLead = {
  name: string;
  description: string;
  task: string;
};

export type NiaContext = {
  what_you_build: string;
  next_goal: string;
  vc_context: string;
  suggested_goal: string;
  analyzed_at: string;
  // Enriched fields populated by nia-refresh
  trending?: string;
  vc_leads?: NiaVcLead[];
  nia_tasks?: NiaTask[];
};

export type Bet = {
  id: string;
  user_id: string;
  goal: string;
  stake: string;
  github_repo: string | null;
  deadline: string;
  status: "active" | "hit" | "missed" | "pending_eval";
  task_type: "github" | "email" | "nia";
  progress: number;
  progress_score: number;
  agent_last_run: string | null;
  commits_found: number;
  findings: string | null;
  verdict_reason: string | null;
  github_access_token: string | null;
  nia_context: NiaContext | null;
  created_at: string;
  updated_at: string;
  // Joined
  users?: InsforgeUser;
};

export type TensorlakeResult = {
  type: string;
  exit_code: number;
  tests_passed: number;
  tests_failed: number;
  build_success: boolean;
  summary: string;
  raw_output: string;
};

export type Evidence = {
  id: string;
  bet_id: string;
  agent_version: string;
  commits_found: number;
  progress_score: number;
  findings: string | null;
  next_steps: string[] | null;
  commit_messages: string[] | null;
  nia_summary: string | null;
  tensorlake_result: TensorlakeResult | null;
  created_at: string;
};
