// Server-side only — uses admin key for privileged operations
import { createClient } from "@insforge/sdk";

const INSFORGE_URL =
  process.env.NEXT_PUBLIC_INSFORGE_URL || "https://4vxtn8fe.us-east.insforge.app";
const INSFORGE_ADMIN_KEY = process.env.INSFORGE_ADMIN_KEY || "";

export function getAdminClient() {
  return createClient({
    baseUrl: INSFORGE_URL,
    anonKey: INSFORGE_ADMIN_KEY,
  });
}
