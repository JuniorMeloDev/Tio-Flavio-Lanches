import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify(data), { status: 200 });
}

export async function POST(request) {
  const { nome } = await request.json();

  if (!nome) {
    return new Response(JSON.stringify({ error: 'Nome da categoria é obrigatório' }), { status: 400 });
  }

  const { data, error } = await supabase
    .from('categorias')
    .insert([{ nome }])
    .select()
    .single();
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify(data), { status: 201 });
}

export async function PUT(request) {
  const { id, nome } = await request.json();

  if (!id || !nome) {
    return new Response(JSON.stringify({ error: 'ID e Nome são obrigatórios' }), { status: 400 });
  }

  const { data, error } = await supabase
    .from('categorias')
    .update({ nome })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify(data), { status: 200 });
}

export async function DELETE(request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return new Response(JSON.stringify({ error: 'ID é obrigatório' }), { status: 400 });
    }

    const { error } = await supabase
        .from('categorias')
        .delete()
        .eq('id', id);

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
    return new Response(JSON.stringify({ message: 'Categoria excluída com sucesso' }), { status: 200 });
}
