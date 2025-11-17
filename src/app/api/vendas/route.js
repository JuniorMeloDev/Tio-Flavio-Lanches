import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET: Busca o histórico de vendas PAGAS com detalhes para cálculo de custo
export async function GET() {
    // Busca vendas 'Pagas' e seus itens com custo unitário
    const { data, error } = await supabase
        .from('vendas')
        .select(`
            id,
            valor_total,
            metodo_pagamento,
            criado_em,
            nome_cliente,
            status,
            custo_pagamento,
            desconto,
            itens_venda (
                quantidade,
                preco_unitario,
                preco_custo_unitario,
                produtos ( nome )
            )
        `)
        .eq('status', 'Pago') // Somente vendas pagas
        .order('criado_em', { ascending: false });

    if (error) {
        console.error("Erro ao buscar vendas detalhadas:", error);
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
    return new NextResponse(JSON.stringify(data), { status: 200 });
}

// POST: Registra uma nova venda
export async function POST(request) {
    // Extrai custo_pagamento junto com os outros dados
    const { itens, total, metodo_pagamento, nome_cliente, custo_pagamento } = await request.json();

    // Validação do preço de custo (mantida)
    for (const item of itens) {
        if (item.preco_custo === null || item.preco_custo === undefined) {
             return new NextResponse(JSON.stringify({ message: `O produto '${item.nome}' não tem um preço de custo definido.` }), { status: 400 });
        }
    }

    // Chama a função do Supabase passando os 5 parâmetros
    const { data, error } = await supabase.rpc('finalizar_venda', {
        itens_venda: itens,
        valor_total_venda: total,
        metodo_pagamento_venda: metodo_pagamento,
        nome_cliente_venda: nome_cliente,
        custo_pagamento_venda: custo_pagamento // <<< Parâmetro que estava a faltar na chamada
    });
    
    if (error) {
  console.error('Erro ao chamar a função do Supabase (finalizar_venda):', error);
  return new NextResponse(JSON.stringify({ message: error.message }), { status: 500 });
}

// ✅ Venda criada com sucesso
const vendaId = data;

// 🔔 Dispara push
try {
  const payload = {
    title: '🍔 Novo pedido recebido!',
    body: `Pedido #${vendaId} criado e enviado para a cozinha.`,
    url: '/cozinha'
  };

  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/push/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
} catch (pushErr) {
  console.error('Falha ao enviar notificação push:', pushErr);
}

return new NextResponse(JSON.stringify({ venda_id: vendaId }), { status: 201 });
}