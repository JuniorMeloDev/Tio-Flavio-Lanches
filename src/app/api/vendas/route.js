import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET: Busca o histórico de vendas PAGAS
export async function GET() {
    const { data, error } = await supabase
        .from('vendas')
        .select('*')
        .eq('status', 'Pago') // Filtra apenas vendas com o estado 'Pago'
        .order('criado_em', { ascending: false });

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
    return new Response(JSON.stringify(data), { status: 200 });
}

// POST: Registra uma nova venda
export async function POST(request) {
    const { itens, total, metodo_pagamento, nome_cliente } = await request.json();

    for (const item of itens) {
        if (item.preco_custo === null || item.preco_custo === undefined) {
             return new Response(JSON.stringify({ message: `O produto '${item.nome}' não tem um preço de custo definido.` }), { status: 400 });
        }
    }

    const { data, error } = await supabase.rpc('finalizar_venda', {
        itens_venda: itens,
        valor_total_venda: total,
        metodo_pagamento_venda: metodo_pagamento,
        nome_cliente_venda: nome_cliente
    });
    
    if (error) {
        console.error('Erro ao chamar a função do Supabase:', error);
        return new Response(JSON.stringify({ message: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ venda_id: data }), { status: 201 });
}

