import { NextResponse } from 'next/server';
import Hyperspell from '@hyperspell/hyperspell';
import { createClient } from '@insforge/sdk';

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL || 'https://4vxtn8fe.us-east.insforge.app';
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || '';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const insforgeServer = createClient({
      baseUrl: INSFORGE_URL,
      anonKey: INSFORGE_ANON_KEY,
      isServerMode: true,
      edgeFunctionToken: accessToken,
    });
    const { data, error } = await insforgeServer.auth.getCurrentUser();

    if (error || !data?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = data.user.id;

    const hyperspell = new Hyperspell({
      apiKey: process.env.HYPERSPELL_API_KEY!,
    });

    const response = await hyperspell.auth.userToken({ user_id: userId });

    return NextResponse.json({ token: response.token });
  } catch (err) {
    console.error('Failed to generate Hyperspell token:', err);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
