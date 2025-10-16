'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, ChefHat, Check, CookingPot, XCircle } from 'lucide-react';

export default function CozinhaPage() {
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [orderToPay, setOrderToPay] = useState(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('Dinheiro');
    const [cardType, setCardType] = useState(null); // 'Débito' ou 'Crédito'
    const [errorMessage, setErrorMessage] = useState('');

    const fetchPedidos = async () => {
        try {
            const res = await fetch('/api/vendas/cozinha');
            if (!res.ok) throw new Error("Falha ao buscar pedidos da API.");
            const data = await res.json();
            setPedidos(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Erro ao buscar pedidos:", error);
            setPedidos([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPedidos();
        const interval = setInterval(fetchPedidos, 15000);
        return () => clearInterval(interval);
    }, []);
    
    const pedidosRecebidos = useMemo(() => pedidos.filter(p => p.status === 'Recebido'), [pedidos]);
    const pedidosEmProducao = useMemo(() => pedidos.filter(p => p.status === 'Em Produção'), [pedidos]);

    const handleUpdateStatus = async (pedidoId, newStatus) => {
        try {
            const res = await fetch('/api/vendas/cozinha', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: pedidoId, status: newStatus }),
            });
            if (!res.ok) throw new Error("Falha ao atualizar o estado do pedido.");

            setPedidos(currentPedidos => currentPedidos.map(p => 
                p.id === pedidoId ? { ...p, status: newStatus } : p
            ));
        } catch (error) {
            console.error(error);
            setErrorMessage(error.message);
        }
    };

    const openPaymentModal = (pedido) => {
        setOrderToPay(pedido);
        setSelectedPaymentMethod('Dinheiro'); // Reseta para o padrão
        setCardType(null);
        setIsPaymentModalOpen(true);
    };
    
    const handleConfirmPayment = async () => {
        if (!orderToPay) return;

        let finalPaymentMethod = selectedPaymentMethod;
        if (selectedPaymentMethod === 'Cartão') {
            if (!cardType) {
                alert('Por favor, selecione Débito ou Crédito.');
                return;
            }
            finalPaymentMethod = `Cartão - ${cardType}`;
        }

        try {
            const res = await fetch('/api/vendas/cozinha', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: orderToPay.id, 
                    status: 'Pago', 
                    metodo_pagamento: finalPaymentMethod 
                }),
            });
            if (!res.ok) throw new Error("Falha ao finalizar o pagamento.");

            setPedidos(currentPedidos => currentPedidos.filter(p => p.id !== orderToPay.id));
            setIsPaymentModalOpen(false);
            setOrderToPay(null);
        } catch (error) {
            console.error(error);
            setErrorMessage(error.message);
        }
    };

    const PedidoCard = ({ pedido }) => (
        <div key={pedido.id} className={`rounded-lg shadow-lg p-5 flex flex-col justify-between ${pedido.status === 'Recebido' ? 'bg-yellow-50' : 'bg-green-50'}`}>
            <div>
                <div className="flex justify-between items-start border-b pb-3 mb-3">
                    <div>
                        <p className="text-sm text-gray-600">Pedido #{pedido.id}</p>
                        <p className="font-bold text-xl text-gray-900">{pedido.nome_cliente}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${pedido.status === 'Recebido' ? 'bg-orange-200 text-orange-800' : 'bg-blue-200 text-blue-800'}`}>
                        {pedido.status}
                    </span>
                </div>
                <ul className="space-y-2 mb-4">
                    {pedido.itens_venda && pedido.itens_venda.map((item, index) => (
                        <li key={index} className="flex justify-between items-center text-gray-800">
                            <span className="font-semibold">{item.quantidade}x</span>
                            <span>{item.produtos?.nome || 'Produto...'}</span>
                        </li>
                    ))}
                </ul>
                <div className="border-t pt-2 flex justify-between font-bold text-lg text-gray-900">
                    <span>Total:</span>
                    <span>{Number(pedido.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
            </div>
            {pedido.status === 'Recebido' ? (
                <button 
                    onClick={() => handleUpdateStatus(pedido.id, 'Em Produção')}
                    className="w-full mt-5 bg-orange-500 text-white py-2 rounded-lg font-bold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2">
                    <CookingPot size={20} />
                    Iniciar Produção
                </button>
            ) : (
                <button 
                    onClick={() => openPaymentModal(pedido)}
                    className="w-full mt-5 bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                    <Check size={20} />
                    Pedido Pronto / Pagar
                </button>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#3A3226] to-[#251a08] p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <ChefHat size={32} />
                        Pedidos da Cozinha
                    </h1>
                    <a href="/" className="flex items-center gap-2 px-4 py-2 bg-[#A16207] text-white rounded-lg font-semibold hover:bg-[#8f5606] transition-colors">
                        <ArrowLeft size={18} />
                        Voltar ao Início
                    </a>
                </div>

                {loading && <p className="text-center text-gray-300">A carregar pedidos...</p>}
                
                {!loading && pedidos.length === 0 && (
                    <div className="text-center py-20 bg-white/5 rounded-lg">
                        <p className="text-xl text-gray-300">Nenhum pedido pendente.</p>
                    </div>
                )}
                
                <div className="space-y-8">
                    {pedidosRecebidos.length > 0 && (
                        <div>
                            <h2 className="text-xl font-semibold text-yellow-300 mb-4">Novos Pedidos</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {pedidosRecebidos.map(pedido => <PedidoCard key={pedido.id} pedido={pedido} />)}
                            </div>
                        </div>
                    )}
                    {pedidosEmProducao.length > 0 && (
                         <div>
                            <h2 className="text-xl font-semibold text-blue-300 mb-4">Em Produção</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {pedidosEmProducao.map(pedido => <PedidoCard key={pedido.id} pedido={pedido} />)}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isPaymentModalOpen && orderToPay && (
              <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-sm m-4">
                  <h2 className="text-2xl font-bold mb-6 text-center">Finalizar Pedido #{orderToPay.id}</h2>
                  <p className="text-5xl font-bold text-center mb-6 text-[#A16207]">
                    {Number(orderToPay.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <h3 className="text-lg font-semibold mb-3">Forma de Pagamento:</h3>
                  <div className="flex flex-col gap-3 mb-6">
                    {['Dinheiro', 'Pix'].map(method => (
                      <button
                          key={method}
                          onClick={() => { setSelectedPaymentMethod(method); setCardType(null); }}
                          className={`w-full py-3 rounded-lg font-semibold text-lg border-2 ${selectedPaymentMethod === method ? 'bg-[#A16207] text-white border-[#A16207]' : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'}`}
                      >
                          {method}
                      </button>
                    ))}
                    <button
                        onClick={() => setSelectedPaymentMethod('Cartão')}
                        className={`w-full py-3 rounded-lg font-semibold text-lg border-2 ${selectedPaymentMethod === 'Cartão' ? 'bg-[#A16207] text-white border-[#A16207]' : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'}`}
                    >
                        Cartão
                    </button>
                    {selectedPaymentMethod === 'Cartão' && (
                        <div className="flex gap-3 animate-fade-in">
                            <button
                                onClick={() => setCardType('Débito')}
                                className={`w-full py-2 rounded-lg font-semibold border-2 ${cardType === 'Débito' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-100 text-blue-800 border-blue-200'}`}
                            >
                                Débito
                            </button>
                            <button
                                onClick={() => setCardType('Crédito')}
                                className={`w-full py-2 rounded-lg font-semibold border-2 ${cardType === 'Crédito' ? 'bg-purple-600 text-white border-purple-600' : 'bg-purple-100 text-purple-800 border-purple-200'}`}
                            >
                                Crédito
                            </button>
                        </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-3">
                    <button onClick={handleConfirmPayment} className="w-full bg-[#A16207] text-white py-3 rounded-lg font-bold">Confirmar Pagamento</button>
                    <button onClick={() => setIsPaymentModalOpen(false)} className="w-full bg-transparent text-gray-600 py-2 rounded-lg font-semibold hover:bg-gray-100">Cancelar</button>
                  </div>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                  <div className="bg-white p-10 rounded-lg shadow-xl w-full max-w-sm m-4 text-center">
                      <XCircle size={50} className="text-red-500 mx-auto mb-4" />
                      <h2 className="text-xl font-bold mb-2">Erro</h2>
                      <p className="text-gray-600 mb-6">{errorMessage}</p>
                      <button onClick={() => setErrorMessage('')} className="px-6 py-2 bg-gray-200 rounded-lg font-semibold">
                          Fechar
                      </button>
                  </div>
              </div>
            )}
        </div>
    );
}

