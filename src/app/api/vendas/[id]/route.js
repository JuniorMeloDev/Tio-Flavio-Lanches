import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET: Busca os detalhes completos de uma única venda
export async function GET(request, { params }) {
  const { id } = params;
  if (!id) return NextResponse.json({ message: 'ID obrigatório.' }, { status: 400 });

  try {
    const { data: vendaData, error: vendaError } = await supabase
      .from('vendas')
      .select('*')
      .eq('id', id)
      .single();

    if (vendaError) throw vendaError;

    const { data: itensData, error: itensError } = await supabase
      .from('itens_venda')
      .select(`quantidade, preco_unitario, produtos ( nome )`)
      .eq('venda_id', id);

    if (itensError) throw itensError;

    return NextResponse.json({ ...vendaData, itens: itensData });
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// PUT: Edita os itens de uma venda (Recalcula estoque e total)
export async function PUT(request, { params }) {
  const { id } = params;
  const { itens, total } = await request.json(); // 'itens' é a NOVA lista desejada

  if (!id || !itens) return NextResponse.json({ message: 'Dados inválidos.' }, { status: 400 });

  try {
    // 1. Buscar itens ANTIGOS para restaurar estoque
    const { data: oldItems, error: fetchError } = await supabase
      .from('itens_venda')
      .select('produto_id, quantidade')
      .eq('venda_id', id);
    
    if (fetchError) throw fetchError;

    // 2. Restaurar estoque dos itens antigos
    for (const item of oldItems) {
      // Busca estoque atual
      const { data: prod } = await supabase.from('produtos').select('quantidade_estoque').eq('id', item.produto_id).single();
      if (prod) {
        await supabase.from('produtos')
          .update({ quantidade_estoque: prod.quantidade_estoque + item.quantidade })
          .eq('id', item.produto_id);
      }
    }

    // 3. Limpar itens antigos da venda
    const { error: deleteError } = await supabase.from('itens_venda').delete().eq('venda_id', id);
    if (deleteError) throw deleteError;

    // 4. Inserir NOVOS itens e Deduzir estoque
    const itensParaInserir = [];
    let custoTotalPagamento = 0; // Se quiser recalcular custo base, senão mantém

    for (const newItem of itens) {
      // Deduz estoque
      const { data: prod } = await supabase.from('produtos').select('quantidade_estoque, preco_custo').eq('id', newItem.id).single();
      
      if (prod) {
        await supabase.from('produtos')
          .update({ quantidade_estoque: prod.quantidade_estoque - newItem.quantity })
          .eq('id', newItem.id);
        
        itensParaInserir.push({
          venda_id: id,
          produto_id: newItem.id,
          quantidade: newItem.quantity,
          preco_unitario: newItem.preco,
          preco_custo_unitario: prod.preco_custo // Mantém histórico de custo
        });
      }
    }

    if (itensParaInserir.length > 0) {
      const { error: insertError } = await supabase.from('itens_venda').insert(itensParaInserir);
      if (insertError) throw insertError;
    }

    // 5. Atualizar total da venda
    const { error: updateError } = await supabase
      .from('vendas')
      .update({ valor_total: total })
      .eq('id', id);

    if (updateError) throw updateError;

    return NextResponse.json({ message: 'Venda atualizada com sucesso' });

  } catch (error) {
    console.error("Erro ao editar venda:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// DELETE: Exclui venda
export async function DELETE(request, { params }) {
  const { id } = params;
  if (!id) return NextResponse.json({ message: 'ID obrigatório.' }, { status: 400 });

  try {
    const { error } = await supabase.rpc('excluir_venda_e_restaurar_estoque', { p_venda_id: id });
    if (error) throw new Error(error.message);
    return NextResponse.json({ message: `Venda #${id} excluída.` });
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}