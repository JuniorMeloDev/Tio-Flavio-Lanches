import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const sub = await req.json();
  if (!sub?.endpoint) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint: sub.endpoint, keys: sub.keys }, { onConflict: ['endpoint'] });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
