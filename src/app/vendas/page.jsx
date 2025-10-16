'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ShoppingBag, Calendar, DollarSign, CreditCard, ArrowLeft, Printer, X } from 'lucide-react';

// Função para gerar e imprimir o comprovativo
const generateAndPrintReceipt = (venda) => {
    const receiptContent = `
        <div style="font-family: 'Courier New', monospace; width: 300px; padding: 10px; font-size: 12px; color: #000;">
            <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
                <h1 style="font-size: 16px; margin: 0; font-weight: bold;">Tio Flávio Lanches</h1>
                <p style="margin: 2px 0; font-size: 11px;">Rua Fictícia, 123</p>
            </div>
            <div style="margin-bottom: 10px; font-size: 11px;">
                <p style="margin: 2px 0;"><strong>ID Venda:</strong> #${venda.id}</p>
                <p style="margin: 2px 0;"><strong>Data:</strong> ${new Date(venda.criado_em).toLocaleString('pt-BR')}</p>
            </div>
            <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0; margin-bottom: 10px;">
                ${venda.itens.map(item => `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                        <span style="width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.produtos.nome} (${item.quantidade}x)</span>
                        <span>R$ ${(item.quantidade * item.preco_unitario).toFixed(2)}</span>
                    </div>
                `).join('')}
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 10px;">
                <span>Total:</span>
                <span>R$ ${Number(venda.valor_total).toFixed(2)}</span>
            </div>
            <p style="font-size: 11px; margin-top: 5px;"><strong>Pagamento:</strong> ${venda.metodo_pagamento}</p>
        </div>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>Comprovante</title></head><body>${receiptContent}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
};

export default function VendasPage() {
  const [allVendas, setAllVendas] = useState([]);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', minValor: '', maxValor: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchVendas() {
      try {
        const response = await fetch('/api/vendas');
        if (!response.ok) {
          throw new Error('Falha ao carregar os dados das vendas.');
        }
        const data = await response.json();
        setAllVendas(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
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
    });
  }, [allVendas, filters]);
  
  const totalFiltrado = useMemo(() => {
      return filteredVendas.reduce((acc, venda) => acc + venda.valor_total, 0);
  }, [filteredVendas]);

  const handlePrint = async (saleId) => {
    if (!saleId) return;
    try {
      const res = await fetch(`/api/vendas/${saleId}`);
      if (!res.ok) throw new Error('Não foi possível buscar os dados da venda para impressão.');
      const vendaData = await res.json();
      generateAndPrintReceipt(vendaData);
    } catch (error) {
      console.error(error);
      setError(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3A3226] to-[#251a08] p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
           <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShoppingBag size={32} />
            Relatório de Vendas
          </h1>
          <Link href="/">
            <button className="flex items-center gap-2 px-4 py-2 bg-[#A16207] text-white rounded-lg font-semibold hover:bg-[#8f5606] transition-colors">
              <ArrowLeft size={18} />
              Voltar ao Início
            </button>
          </Link>
        </div>
        
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
                    <input type="number" name="minValor" placeholder="Ex: R$10,00" value={filters.minValor} onChange={handleFilterChange} className="mt-1 block w-full p-2 bg-white/10 text-white border border-white/20 rounded-md shadow-sm"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300">Valor Máximo</label>
                    <input type="number" name="maxValor" placeholder="Ex: R$50,00" value={filters.maxValor} onChange={handleFilterChange} className="mt-1 block w-full p-2 bg-white/10 text-white border border-white/20 rounded-md shadow-sm"/>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={clearFilters} className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg font-semibold hover:bg-white/30 transition-colors">
                        <X size={18} /> Limpar
                    </button>
                </div>
            </div>
        </div>
        
        <div className="mb-6 bg-white/10 backdrop-blur-sm p-4 rounded-xl shadow-lg flex justify-around text-center">
            <div>
                <p className="text-sm text-gray-300">Vendas no Período</p>
                <p className="text-2xl font-bold text-white">{filteredVendas.length}</p>
            </div>
            <div>
                <p className="text-sm text-gray-300">Valor Total no Período</p>
                <p className="text-2xl font-bold text-white">
                    {totalFiltrado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
            </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <p className="text-center text-gray-800 py-10">A carregar vendas...</p>
            ) : error ? (
              <p className="text-center text-red-500 py-10">{error}</p>
            ) : filteredVendas.length === 0 ? (
               <p className="text-center text-gray-800 py-10">Nenhuma venda encontrada para os filtros aplicados.</p>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-white/20">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold text-gray-800 uppercase tracking-wider">ID Venda</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-800 uppercase tracking-wider">Data e Hora</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-800 uppercase tracking-wider">Método Pag.</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-800 uppercase tracking-wider text-right">Valor Total</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-800 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/50">
                  {filteredVendas.map((venda) => (
                    <tr key={venda.id} className="hover:bg-black/10">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{venda.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                           <Calendar size={16} />
                           {new Date(venda.criado_em).toLocaleString('pt-BR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          <CreditCard size={16} />
                          {venda.metodo_pagamento}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                        <div className="flex items-center justify-end gap-2">
                           <DollarSign size={16} />
                           {Number(venda.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button 
                          onClick={() => handlePrint(venda.id)}
                          className="text-[#A16207] hover:text-[#8f5606] p-2 rounded-full hover:bg-yellow-100"
                          title="Imprimir Comprovante"
                        >
                          <Printer size={18} />
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
    </div>
  );
}

