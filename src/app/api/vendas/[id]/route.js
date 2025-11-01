import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET: Busca os detalhes completos de uma única venda pelo seu ID
// (Esta função GET permanece sem alterações)
export async function GET(request, { params }) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ message: 'ID da venda não fornecido.' }, { status: 400 });
  }

  try {
    // 1. Busca os dados principais da venda
    const { data: vendaData, error: vendaError } = await supabase
      .from('vendas')
      .select('*')
      .eq('id', id)
      .single();

    if (vendaError) throw vendaError;

    // 2. Busca os itens da venda, juntando com a tabela de produtos para obter o nome
    const { data: itensData, error: itensError } = await supabase
      .from('itens_venda')
      .select(`
        quantidade,
        preco_unitario,
        produtos ( nome )
      `)
      .eq('venda_id', id);

    if (itensError) throw itensError;

    // 3. Combina os resultados
    const comprovanteCompleto = {
      ...vendaData,
      itens: itensData,
    };

    return NextResponse.json(comprovanteCompleto);
  } catch (error) {
    console.error('Erro ao buscar detalhes da venda:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}


// --- FUNÇÃO DELETE TOTALMENTE MODIFICADA ---
// Agora ela chama a função RPC para garantir que o estoque seja restaurado
export async function DELETE(request, { params }) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ message: 'ID da venda não fornecido.' }, { status: 400 });
  }

  try {
    console.log(`Iniciando RPC 'excluir_venda_e_restaurar_estoque' para venda #${id}`);

    // 1. Chama a função RPC no Supabase
    // Esta função fará todo o trabalho: restaurar estoque E excluir a venda.
    const { error } = await supabase.rpc('excluir_venda_e_restaurar_estoque', {
      p_venda_id: id
    });

    // 2. Verifica se a chamada RPC deu erro
    if (error) {
      console.error("Erro ao chamar RPC 'excluir_venda_e_restaurar_estoque':", error);
      throw new Error(`Erro no banco de dados: ${error.message}`);
    }

    // 3. Retorna sucesso
    return NextResponse.json({ message: `Venda #${id} excluída e estoque restaurado com sucesso.` });

  } catch (error) {
    console.error(`Erro completo ao excluir venda #${id}:`, error);
    // Retorna a mensagem de erro específica
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}