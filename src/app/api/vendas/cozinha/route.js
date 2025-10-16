import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET: Busca os pedidos com estado 'Recebido' e 'Em Produção'
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('vendas')
      .select(`
        id,
        criado_em,
        nome_cliente,
        status,
        valor_total, 
        itens_venda (
          quantidade,
          produtos ( nome )
        )
      `)
      .in('status', ['Recebido', 'Em Produção'])
      .order('criado_em', { ascending: true });

    if (error) {
        console.error("Erro na query do Supabase (cozinha):", error);
        throw error;
    }
    
    return NextResponse.json(data || []);
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// PUT: Atualiza o estado de um pedido (pode ou não incluir método de pagamento)
export async function PUT(request) {
    const { id, status, metodo_pagamento } = await request.json();

    if (!id || !status) {
        return NextResponse.json({ message: 'ID do pedido e novo estado são obrigatórios.' }, { status: 400 });
    }

    let updateData = { status };
    if (metodo_pagamento) {
        updateData.metodo_pagamento = metodo_pagamento;
    }

    try {
        const { data, error } = await supabase
            .from('vendas')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}

