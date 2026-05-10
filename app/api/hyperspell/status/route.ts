import { NextResponse } from "next/server";
import Hyperspell from "@hyperspell/hyperspell";
import { getAdminClient } from "@/lib/insforge-admin";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ connected: false });
    }

    const insforgeAdmin = getAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (insforgeAdmin.auth as any).getUser(
      authHeader.replace("Bearer ", "")
    );
    if (error || !data?.user) {
      return NextResponse.json({ connected: false });
    }

    const userId: string = data.user.id;

    const hs = new Hyperspell({
      apiKey: process.env.HYPERSPELL_API_KEY!,
      userID: userId,
    });

    // auth.me returns the user's connected accounts — errors if not connected
    await hs.auth.me();
    return NextResponse.json({ connected: true });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
