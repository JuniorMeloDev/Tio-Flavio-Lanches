import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET: Busca apenas os pedidos com estado 'Recebido' para notificações
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('vendas')
      .select('id')
      .eq('status', 'Recebido');

    if (error) throw error;
    
    return NextResponse.json(data || []);
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
