import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// POST: Recebe um array de produtos e atualiza todos
export async function POST(request) {
  const productsToUpdate = await request.json();

  if (!Array.isArray(productsToUpdate) || productsToUpdate.length === 0) {
    return new Response(JSON.stringify({ message: 'Nenhum dado válido para atualizar' }), { status: 400 });
  }

  // Mapeia os dados para garantir que apenas colunas válidas sejam enviadas
  // Isso é importante por segurança e para evitar erros.
  // A planilha DEVE conter a coluna 'id'.
  const validData = productsToUpdate
    .filter(p => p.id) // Garante que o produto tem um ID
    .map(p => ({
      id: p.id,
      nome: p.nome,
      preco: Number(p.preco) || 0,
      preco_custo: Number(p.preco_custo) || 0,
      quantidade_estoque: Number(p.quantidade_estoque) || 0
      // Adicione outros campos se você os incluiu na exportação (ex: categoria)
    }));
  
  // O 'upsert' do Supabase é perfeito para isso:
  // Ele vai ATUALIZAR os produtos existentes com base no 'id'
  const { data, error } = await supabase
    .from('produtos')
    .upsert(validData, { onConflict: 'id' }); // 'id' deve ser sua chave primária

  if (error) {
    console.error('Supabase batch update error:', error);
    return new Response(JSON.stringify({ message: 'Erro ao atualizar produtos', error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ message: 'Produtos atualizados com sucesso', data }), { status: 200 });
}