// src/app/api/config/taxas/route.js
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use a chave segura
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', ['taxa_dinheiro', 'taxa_pix', 'taxa_debito', 'taxa_credito']); // Busca chaves específicas

    if (error) throw error;

    // Mapeia os resultados para o formato esperado pelo frontend
    const taxasFormatadas = {
      'Dinheiro': 0, // Default
      'Pix': 0, // Default
      'Cartão - Débito': 0, // Default
      'Cartão - Crédito': 0 // Default
    };

    data.forEach(item => {
      if (item.chave === 'taxa_dinheiro') taxasFormatadas['Dinheiro'] = item.valor;
      if (item.chave === 'taxa_pix') taxasFormatadas['Pix'] = item.valor;
      if (item.chave === 'taxa_debito') taxasFormatadas['Cartão - Débito'] = item.valor;
      if (item.chave === 'taxa_credito') taxasFormatadas['Cartão - Crédito'] = item.valor;
    });

    return NextResponse.json(taxasFormatadas);
  } catch (error) {
    console.error("Erro ao buscar taxas de pagamento:", error);
    return NextResponse.json({ message: 'Erro ao buscar configuração de taxas.' }, { status: 500 });
  }
}

// --- NOVA FUNÇÃO PUT para salvar as taxas ---
export async function PUT(request) {
    try {
        const novasTaxas = await request.json();

        // Prepara os dados para upsert (atualiza se existe, insere se não existe)
        const updates = [
            { chave: 'taxa_dinheiro', valor: novasTaxas['Dinheiro'] },
            { chave: 'taxa_pix', valor: novasTaxas['Pix'] },
            { chave: 'taxa_debito', valor: novasTaxas['Cartão - Débito'] },
            { chave: 'taxa_credito', valor: novasTaxas['Cartão - Crédito'] }
        ];

        const { error } = await supabase
            .from('configuracoes')
            .upsert(updates, { onConflict: 'chave' }); // Usa a coluna 'chave' para identificar conflitos

        if (error) throw error;

        return NextResponse.json({ message: 'Taxas atualizadas com sucesso!' });
    } catch (error) {
         console.error("Erro ao atualizar taxas de pagamento:", error);
         return NextResponse.json({ message: 'Erro ao atualizar configuração de taxas.' }, { status: 500 });
    }
}