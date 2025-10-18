// src/app/vendas/page.jsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
// Adiciona a importação do SheetJS (xlsx)
import * as XLSX from 'xlsx';
import { ShoppingBag, Calendar, DollarSign, CreditCard, ArrowLeft, Printer, X, Settings, Loader2, Save, FileText, AlertCircle, Download } from 'lucide-react'; // Ícones adicionados

// Função para gerar e imprimir o comprovativo INDIVIDUAL (ATUALIZADA para quebra de linha)
const generateAndPrintReceipt = (venda) => {
    const receiptContent = `
        <div style="font-family: 'Courier New', monospace; width: 300px; padding: 10px; font-size: 15px; color: #000; font-weight: bold;">
             <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
                 <h1 style="font-size: 20px; margin: 0; font-weight: bold;">Tio Flávio Lanches</h1>
                 <p style="margin: 2px 0; font-size: 15px;">Rua Antônio Ferreira Campos, 5170</p>
             </div>
             <div style="margin-bottom: 10px; font-size: 15px;">
                 <p style="margin: 2px 0;"><strong>ID Venda:</strong> #${venda.id}</p>
                 <p style="margin: 2px 0;"><strong>Data:</strong> ${new Date(venda.criado_em).toLocaleString('pt-BR')}</p>
             </div>
             <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0; margin-bottom: 10px;">
                 ${venda.itens?.map(item => `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3px;">
                        <span style="max-width: 200px;">${item.produtos?.nome || 'Produto Removido'} (${item.quantidade}x)</span>
                        <span>R$ ${(item.quantidade * item.preco_unitario).toFixed(2)}</span>
                    </div>
                 `).join('')}
             </div>
             <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; margin-top: 10px;">
                 <span>Total:</span>
                 <span>R$ ${Number(venda.valor_total).toFixed(2)}</span>
             </div>
             <p style="font-size: 15px; margin-top: 5px;"><strong>Pagamento:</strong> ${venda.metodo_pagamento}</p>
        </div>
    `;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>Comprovante #${venda.id}</title></head><body style="margin:0; padding:0;">${receiptContent}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
};


// --- Função para gerar e imprimir o RELATÓRIO DE CUSTOS ---
const generateAndPrintCostReport = (vendas, totais, filters) => {
    const startDate = filters.startDate ? new Date(filters.startDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Início';
    const endDate = filters.endDate ? new Date(filters.endDate + 'T23:59:59').toLocaleDateString('pt-BR') : 'Fim';
    const periodo = `${startDate} a ${endDate}`;

    const formatCurrency = (value) => (value != null ? value : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const printStyles = `
        @media print {
            @page { size: A4; margin: 20mm; }
            body { font-family: 'Arial', sans-serif; font-size: 10pt; color: #000; background-color: #fff; }
            h1 { font-size: 16pt; text-align: center; margin-bottom: 5mm; }
            h2 { font-size: 12pt; margin-top: 10mm; border-bottom: 1px solid #ccc; padding-bottom: 2mm; margin-bottom: 5mm;}
            p { margin: 1mm 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 5mm; page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            th, td { border: 1px solid #ccc; padding: 3mm 4mm; text-align: left; vertical-align: top; }
            th { background-color: #f0f0f0; font-weight: bold; }
            td.currency, th.currency { text-align: right; }
            .summary-grid { display: grid; grid-template-columns: auto auto; gap: 2mm 8mm; margin-bottom: 8mm; font-size: 11pt; }
            .summary-grid span:nth-child(odd) { font-weight: normal; text-align: left; }
            .summary-grid span:nth-child(even) { font-weight: bold; text-align: right; }
            .total-profit { font-size: 12pt; }
            .cost { color: #000; }
            .profit-positive { color: #000; } 
            .profit-negative { color: #000; } 
            .no-print { display: none; }
            tfoot tr { background-color: #e0e0e0; font-weight: bold;}
        }
        body { font-family: 'Arial', sans-serif; font-size: 12px; }
        h1 { font-size: 28px; }
        h2 { font-size: 20px; margin-top: 15px; border-bottom: 1px dashed #ccc; padding-bottom: 5px;}
        .summary-grid { display: grid; grid-template-columns: auto auto; gap: 5px 15px; margin-bottom: 15px; }
        .summary-grid span:nth-child(even) { font-weight: bold; text-align: right; }
        .total-profit { font-size: 14px; }
        .cost { color: #000; }
        .profit-positive { color: #000; } 
        .profit-negative { color: #000; } 
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px;}
        th, td { border: 1px solid #ccc; padding: 4px; text-align: left; }
        th { background-color: #f0f0f0; font-weight: bold; }
        td.currency, th.currency { text-align: right; }
         tfoot tr { background-color: #e0e0e0; font-weight: bold;}
    `;

    const reportContent = `
        <div style="width: 100%;">
            <div style="text-align: center; border-bottom: 1px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
                <h1>Relatório de Custos e Lucratividade</h1>
                <p>Tio Flávio Lanches</p>
                <p>Período: ${periodo}</p>
            </div>
            <h2>Resumo do Período</h2>
            <div class="summary-grid">
                <span>Total de Vendas:</span> <span>${vendas.length}</span>
                <span>Receita Bruta Total:</span> <span>${formatCurrency(totais.receitaBruta)}</span>
                <span class="cost">Custo Total Produtos:</span> <span class="cost">(${formatCurrency(totais.custoProdutos)})</span>
                <span class="cost">Custo Total Pagamentos:</span> <span class="cost">(${formatCurrency(totais.custoPagamento)})</span>
                <span style="font-weight: bold;">Lucro Bruto Total:</span>
                <span class="total-profit ${totais.lucroBruto >= 0 ? 'profit-positive' : 'profit-negative'}">${formatCurrency(totais.lucroBruto)}</span>
            </div>
            <h2>Detalhes por Venda</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th> <th>Data</th> <th>Cliente</th> <th>Método Pag.</th>
                        <th class="currency">Receita</th> <th class="currency cost">C. Prod</th>
                        <th class="currency cost">C. Pagto</th> <th class="currency">Lucro B.</th>
                    </tr>
                </thead>
                <tbody>
                    ${vendas.map(v => `
                        <tr>
                            <td>#${v.id}</td> <td>${new Date(v.criado_em).toLocaleString('pt-BR')}</td>
                            <td>${v.nome_cliente || '-'}</td> <td>${v.metodo_pagamento || '-'}</td>
                            <td class="currency">${formatCurrency(v.valor_total)}</td>
                            <td class="currency cost">${formatCurrency(v.custoProdutosCalculado)}</td>
                            <td class="currency cost">${formatCurrency(v.custo_pagamento)}</td>
                            <td class="currency ${v.lucroCalculado >= 0 ? 'profit-positive' : 'profit-negative'}" style="font-weight: bold;">${formatCurrency(v.lucroCalculado)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                 <tfoot>
                    <tr>
                        <td colspan="4" style="text-align: right;">TOTAIS:</td>
                        <td class="currency">${formatCurrency(totais.receitaBruta)}</td>
                        <td class="currency cost">${formatCurrency(totais.custoProdutos)}</td>
                        <td class="currency cost">${formatCurrency(totais.custoPagamento)}</td>
                        <td class="currency ${totais.lucroBruto >= 0 ? 'profit-positive' : 'profit-negative'}">${formatCurrency(totais.lucroBruto)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>Relatório de Custos - ${periodo}</title><style>${printStyles}</style></head><body>${reportContent}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 500);
};


export default function VendasPage() {
  const [allVendas, setAllVendas] = useState([]);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', minValor: '', maxValor: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTaxasModalOpen, setIsTaxasModalOpen] = useState(false);
  const [isLoadingTaxas, setIsLoadingTaxas] = useState(false);
  const [editableTaxas, setEditableTaxas] = useState({
    'Dinheiro': 0, 'Pix': 0, 'Cartão - Débito': 0, 'Cartão - Crédito': 0
  });
  const [taxasError, setTaxasError] = useState('');
  const [taxasSuccess, setTaxasSuccess] = useState('');

  // --- Funções de Taxas ---
  const fetchTaxas = async () => {
    setIsLoadingTaxas(true); setTaxasError('');
    try {
      const res = await fetch('/api/config/taxas');
      if (!res.ok) throw new Error('Falha ao buscar taxas.');
      const data = await res.json(); setEditableTaxas(data);
    } catch (err) {
      setTaxasError(err.message || 'Erro ao carregar taxas.');
      setEditableTaxas({ 'Dinheiro': 0, 'Pix': 0, 'Cartão - Débito': 0, 'Cartão - Crédito': 0 });
    } finally { setIsLoadingTaxas(false); }
  };
  const handleSaveTaxas = async () => {
    setIsLoadingTaxas(true); setTaxasError(''); setTaxasSuccess('');
    try {
      const taxasParaSalvar = {};
      Object.entries(editableTaxas).forEach(([key, value]) => { taxasParaSalvar[key] = parseFloat(value) || 0; });
      const res = await fetch('/api/config/taxas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taxasParaSalvar) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Falha ao salvar taxas.'); }
      setTaxasSuccess('Taxas salvas com sucesso!');
      setTimeout(() => { setIsTaxasModalOpen(false); setTaxasSuccess(''); }, 1500);
    } catch (err) { setTaxasError(err.message || 'Erro ao salvar taxas.'); }
    finally { setIsLoadingTaxas(false); }
  };
  const handleTaxaInputChange = (method, value) => {
    const sanitizedValue = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setEditableTaxas(prev => ({ ...prev, [method]: sanitizedValue }));
  };
  const openTaxasModal = () => { fetchTaxas(); setIsTaxasModalOpen(true); };
  // -------------------------

  useEffect(() => {
    async function fetchVendas() {
      setError(null); setLoading(true);
      try {
        const response = await fetch('/api/vendas');
        if (!response.ok) { throw new Error('Falha ao carregar os dados das vendas.'); }
        const data = await response.json(); setAllVendas(data);
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    }
    fetchVendas();
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  const clearFilters = () => {
    setFilters({ startDate: '', endDate: '', minValor: '', maxValor: '' });
  };

  const filteredVendas = useMemo(() => {
    return allVendas.filter(venda => {
            const vendaDate = new Date(venda.criado_em);
            const startDate = filters.startDate ? new Date(filters.startDate + 'T00:00:00') : null;
            const endDate = filters.endDate ? new Date(filters.endDate + 'T23:59:59') : null;
            const minValor = filters.minValor ? parseFloat(filters.minValor) : null;
            const maxValor = filters.maxValor ? parseFloat(filters.maxValor) : null;
            if (startDate && vendaDate < startDate) return false;
            if (endDate && vendaDate > endDate) return false;
            if (minValor !== null && venda.valor_total < minValor) return false;
            if (maxValor !== null && venda.valor_total > maxValor) return false;
            return true;
        }).map(venda => {
            const custoProdutosCalculado = venda.itens_venda?.reduce((sum, item) => sum + (item.quantidade * (item.preco_custo_unitario ?? 0)), 0) || 0;
            const custoPagamento = venda.custo_pagamento ?? 0;
            const lucroCalculado = venda.valor_total - custoProdutosCalculado - custoPagamento;
            return { ...venda, custoProdutosCalculado, lucroCalculado };
        }).sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
  }, [allVendas, filters]);

  const totaisPeriodo = useMemo(() => {
    return filteredVendas.reduce((acc, venda) => {
        acc.receitaBruta += venda.valor_total;
        acc.custoProdutos += venda.custoProdutosCalculado;
        acc.custoPagamento += venda.custo_pagamento ?? 0;
        acc.lucroBruto += venda.lucroCalculado;
        return acc;
    }, { receitaBruta: 0, custoProdutos: 0, custoPagamento: 0, lucroBruto: 0 });
  }, [filteredVendas]);

  const handlePrintReceipt = async (saleId) => {
    if (!saleId) return;
    try {
      const res = await fetch(`/api/vendas/${saleId}`);
      if (!res.ok) throw new Error('Não foi possível buscar os dados da venda para impressão.');
      const vendaData = await res.json();
      generateAndPrintReceipt(vendaData);
    } catch (err) {
      console.error("Erro ao imprimir comprovante:", err);
      setError(err.message || 'Erro ao gerar comprovante.');
    }
  };

  const handlePrintCostReport = () => {
    if (filteredVendas.length === 0) { alert("Nenhuma venda encontrada para gerar o relatório."); return; }
    generateAndPrintCostReport(filteredVendas, totaisPeriodo, filters);
  };

  const handleExportXLSX = () => {
        if (filteredVendas.length === 0) { alert("Nenhuma venda encontrada para exportar."); return; }
        const dataToExport = filteredVendas.map(v => ({
            'ID Venda': `#${v.id}`, 'Data': new Date(v.criado_em).toLocaleDateString('pt-BR'),
            'Hora': new Date(v.criado_em).toLocaleTimeString('pt-BR'), 'Cliente': v.nome_cliente || '-',
            'Método Pag.': v.metodo_pagamento || '-', 'Receita Bruta': v.valor_total,
            'Custo Produtos': v.custoProdutosCalculado, 'Custo Pagamento': v.custo_pagamento ?? 0,
            'Lucro Bruto': v.lucroCalculado,
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const totalRow = {
            'ID Venda': 'TOTAIS:', 'Receita Bruta': totaisPeriodo.receitaBruta,
            'Custo Produtos': totaisPeriodo.custoProdutos, 'Custo Pagamento': totaisPeriodo.custoPagamento,
            'Lucro Bruto': totaisPeriodo.lucroBruto,
        };
        XLSX.utils.sheet_add_json(ws, [totalRow], { skipHeader: true, origin: -1 });
        ws['!cols'] = [ { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, ];
        const range = XLSX.utils.decode_range(ws['!ref']);
        const currencyCols = [5, 6, 7, 8];
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
            currencyCols.forEach(C => {
                const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });
                if (ws[cell_ref] && ws[cell_ref].v !== undefined) {
                     ws[cell_ref].t = 'n'; ws[cell_ref].z = 'R$ #,##0.00';
                     if (R === range.e.r && (C === 6 || C === 7)) { ws[cell_ref].s = { font: { color: { rgb: "FF880000" } }, numFmt: 'R$ #,##0.00' }; }
                     if (R === range.e.r && C === 8) { ws[cell_ref].s = { font: { color: { rgb: ws[cell_ref].v >= 0 ? "FF006600" : "FFAA0000"} }, numFmt: 'R$ #,##0.00' }; }
                }
            });
        }
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'RelatorioVendas');
        const dataFiltro = filters.startDate || filters.endDate ? `_${filters.startDate}_a_${filters.endDate}` : '';
        const fileName = `Relatorio_Vendas_Custos${dataFiltro}.xlsx`;
        XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3A3226] to-[#251a08] p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-6 flex items-center justify-between">
           <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShoppingBag size={32} /> Relatório de Vendas
          </h1>
          <div className="flex items-center gap-4">
            <button
                onClick={openTaxasModal}
                title="Configurar Taxas de Pagamento"
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
                <Settings size={18} /> Taxas
            </button>
            <Link href="/">
              <button className="flex items-center gap-2 px-4 py-2 bg-[#A16207] text-white rounded-lg font-semibold hover:bg-[#8f5606] transition-colors">
                <ArrowLeft size={18} /> Voltar
              </button>
            </Link>
          </div>
        </div>

        {/* Filtros e Botões de Ação */}
        <div className="mb-6 bg-white/10 backdrop-blur-sm p-4 rounded-xl shadow-lg">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium text-gray-300">Data Inicial</label>
                    <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="mt-1 block w-full p-2 bg-white/10 text-white border border-white/20 rounded-md shadow-sm"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300">Data Final</label>
                    <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="mt-1 block w-full p-2 bg-white/10 text-white border border-white/20 rounded-md shadow-sm"/>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300">Valor Mínimo</label>
                    <input type="number" name="minValor" placeholder="Ex: 10.00" value={filters.minValor} onChange={handleFilterChange} className="mt-1 block w-full p-2 bg-white/10 text-white border border-white/20 rounded-md shadow-sm"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300">Valor Máximo</label>
                    <input type="number" name="maxValor" placeholder="Ex: 50.00" value={filters.maxValor} onChange={handleFilterChange} className="mt-1 block w-full p-2 bg-white/10 text-white border border-white/20 rounded-md shadow-sm"/>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={clearFilters} className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg font-semibold hover:bg-white/30 transition-colors">
                        <X size={18} /> Limpar
                    </button>
                </div>
            </div>
             <div className="mt-4 flex flex-wrap justify-end gap-3">
                <button
                    onClick={handlePrintCostReport}
                    disabled={loading || filteredVendas.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Gerar relatório detalhado para impressão ou salvar como PDF (formato A4)"
                >
                    <Printer size={18} /> Gerar PDF/Imprimir
                </button>
                 <button
                    onClick={handleExportXLSX}
                    disabled={loading || filteredVendas.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Exportar dados do período filtrado para um arquivo Excel (.xlsx)"
                >
                    <Download size={18} /> Exportar XLSX
                </button>
            </div>
        </div>

        {/* Resumo Financeiro */}
        <div className="mb-6 bg-white/10 backdrop-blur-sm p-4 rounded-xl shadow-lg grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
             <div>
                <p className="text-sm text-gray-300">Vendas Período</p>
                <p className="text-2xl font-bold text-white">{filteredVendas.length}</p>
            </div>
            <div>
                <p className="text-sm text-gray-300">Receita Bruta</p>
                <p className="text-2xl font-bold text-white">
                    {totaisPeriodo.receitaBruta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
            </div>
            <div>
                <p className="text-sm text-gray-300">Custos Totais</p>
                <p className="text-lg font-bold text-red-300">
                    ({(totaisPeriodo.custoProdutos + totaisPeriodo.custoPagamento).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                </p>
                 <p className="text-xs text-gray-400">Prod: {totaisPeriodo.custoProdutos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / Pagto: {totaisPeriodo.custoPagamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
             <div>
                <p className="text-sm text-gray-300">Lucro Bruto</p>
                <p className={`text-2xl font-bold ${totaisPeriodo.lucroBruto >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                    {totaisPeriodo.lucroBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
            </div>
        </div>

        {/* Tabela de Vendas */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <p className="text-center text-gray-800 py-10 flex justify-center items-center gap-2"><Loader2 className="animate-spin" size={20}/> Carregando vendas...</p>
            ) : error ? (
              <p className="text-center text-red-500 py-10 flex justify-center items-center gap-2"><AlertCircle size={20} /> {error}</p>
            ) : filteredVendas.length === 0 ? (
               <p className="text-center text-gray-800 py-10">Nenhuma venda encontrada para os filtros aplicados.</p>
            ) : (
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-white/20">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold text-gray-800 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-800 uppercase tracking-wider">Data e Hora</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-800 uppercase tracking-wider">Método Pag.</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-800 uppercase tracking-wider text-right">Valor Total</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-800 uppercase tracking-wider text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/50">
                  {filteredVendas.map((venda) => (
                    <tr key={venda.id} className="hover:bg-black/10">
                       <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">#{venda.id}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        <div className="flex items-center gap-1">
                           <Calendar size={14} />
                           {new Date(venda.criado_em).toLocaleString('pt-BR')}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        <div className="flex items-center gap-1">
                          <CreditCard size={14} />
                          {venda.metodo_pagamento}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                        <div className="flex items-center justify-end gap-1">
                           <DollarSign size={14} />
                           {Number(venda.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm">
                        <button
                          onClick={() => handlePrintReceipt(venda.id)}
                          className="text-[#A16207] hover:text-[#8f5606] p-1 rounded-full hover:bg-yellow-100 mx-auto"
                          title="Imprimir Comprovante"
                        >
                          <Printer size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

       {/* --- Modal Configurar Taxas --- */}
        {isTaxasModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Settings size={22}/> Configurar Taxas (%)</h2>
                        <button onClick={() => setIsTaxasModalOpen(false)} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
                    </div>

                    {isLoadingTaxas && <p className="text-center text-gray-600 mb-4 flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={18}/> Carregando taxas...</p>}
                    {taxasError && <p className="text-center text-red-600 mb-4 p-2 bg-red-100 rounded">{taxasError}</p>}
                    {taxasSuccess && <p className="text-center text-green-600 mb-4 p-2 bg-green-100 rounded">{taxasSuccess}</p>}

                    {!isLoadingTaxas && !taxasSuccess && (
                        <div className="space-y-4 mb-6">
                            {Object.entries(editableTaxas).map(([metodo, taxa]) => (
                                <div key={metodo}>
                                    <label htmlFor={`taxa-${metodo}`} className="block text-sm font-medium text-gray-700">{metodo}</label>
                                    <div className="mt-1 relative rounded-md shadow-sm">
                                         <input
                                            type="text"
                                            inputMode='decimal'
                                            name={`taxa-${metodo}`}
                                            id={`taxa-${metodo}`}
                                            className="focus:ring-[#A16207] focus:border-[#A16207] block w-full pr-10 sm:text-sm border-gray-300 rounded-md py-2 px-3"
                                            placeholder="0.00"
                                            value={editableTaxas[metodo] ?? ''}
                                            onChange={(e) => handleTaxaInputChange(metodo, e.target.value)}
                                        />
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                            <span className="text-gray-500 sm:text-sm">%</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!taxasSuccess && (
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button
                                onClick={() => setIsTaxasModalOpen(false)}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                                disabled={isLoadingTaxas}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveTaxas}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                                disabled={isLoadingTaxas}
                            >
                                {isLoadingTaxas ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />}
                                Salvar Taxas
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
}