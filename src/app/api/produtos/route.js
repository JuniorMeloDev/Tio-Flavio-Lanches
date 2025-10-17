import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET: Busca todos os produtos
export async function GET() {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify(data), { status: 200 });
}

// POST: Cria um novo produto
export async function POST(request) {
  const { nome, preco, quantidade_estoque, categoria, preco_custo, descricao } = await request.json();

  const { data, error } = await supabase
    .from('produtos')
    .insert([{ nome, preco, quantidade_estoque, categoria, preco_custo, descricao }])
    .select()
    .single();
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify(data), { status: 201 });
}

// PUT: Atualiza um produto existente
export async function PUT(request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const { nome, preco, quantidade_estoque, categoria, preco_custo, descricao } = await request.json();

    if (!id) {
        return new Response(JSON.stringify({ error: 'ID do produto é obrigatório' }), { status: 400 });
    }

    const { data, error } = await supabase
        .from('produtos')
        .update({ nome, preco, quantidade_estoque, categoria, preco_custo, descricao })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
    return new Response(JSON.stringify(data), { status: 200 });
}

// DELETE: Apaga permanentemente um produto
export async function DELETE(request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return new Response(JSON.stringify({ error: 'ID do produto é obrigatório' }), { status: 400 });
    }

    const { error } = await supabase
        .from('produtos')
        .delete()
        .eq('id', id);

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
    return new Response(JSON.stringify({ message: 'Produto excluído com sucesso' }), { status: 200 });
}

