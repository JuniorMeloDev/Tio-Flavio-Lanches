'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
// 1. Adicionar Loader2 e XCircle (para o modal)
import { ArrowLeft, ChefHat, Check, CookingPot, XCircle, Copy, CheckCircle, DollarSign, Ban, Loader2, Trash2 } from 'lucide-react';
// --- Funções para gerar o Payload do PIX (BR Code) ---
// ... (código crc16, formatField, generatePixPayload sem alterações) ...
const crc16 = (payload) => {
    let crc = 0xFFFF;
    const polynomial = 0x1021;
    for (let i = 0; i < payload.length; i++) {
        crc ^= payload.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            crc = (crc & 0x8000) ? (crc << 1) ^ polynomial : crc << 1;
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
};

const formatField = (id, value) => {
    const length = value.length.toString().padStart(2, '0');
    return `${id}${length}${value}`;
};

const generatePixPayload = (key, merchantName, city, amount, txid = '***') => {
    const cleanKey = String(key || '').trim().replace(/[^A-Z0-9.\-\/ ]/gi, '');
    const cleanName = String(merchantName || '').trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().substring(0, 25);
    const cleanCity = String(city || '').trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().substring(0, 15);

    const field26 =
        formatField('00', 'BR.GOV.BCB.PIX') +
        formatField('01', cleanKey);

    const amountStr = Number(amount || 0).toFixed(2);

    const payload = [
        formatField('00', '01'),
        formatField('26', field26),
        formatField('52', '0000'),
        formatField('53', '986'),
        formatField('54', amountStr),
        formatField('58', 'BR'),
        formatField('59', cleanName),
        formatField('60', cleanCity),
        formatField('62', formatField('05', txid))
    ].join('');

    const payloadWithCrcMarker = `${payload}6304`;
    const finalCrc = crc16(payloadWithCrcMarker);
    return payloadWithCrcMarker + finalCrc;
};


export default function CozinhaPage() {
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [orderToPay, setOrderToPay] = useState(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('Dinheiro');
    const [cardType, setCardType] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [pixPayload, setPixPayload] = useState('');
    const [copySuccess, setCopySuccess] = useState('');
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const qrCanvasRef = useRef(null);

    // 2. Renomear estados de "Cancelar" para "Excluir"
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    // --- Estados para pagamento em Dinheiro ---
    const [amountReceived, setAmountReceived] = useState('');
    const [changeDue, setChangeDue] = useState(0);

    const PIX_KEY = process.env.NEXT_PUBLIC_PIX_KEY || '';
    const PIX_MERCHANT_NAME = process.env.NEXT_PUBLIC_PIX_MERCHANT_NAME;
    const PIX_MERCHANT_CITY = process.env.NEXT_PUBLIC_PIX_MERCHANT_CITY;

    // --- useEffects (QR Code, Fetch Pedidos) ---
    // ... (useEffect de 'qrious-cdn' sem alterações) ...
    useEffect(() => {
        const scriptId = 'qrious-cdn';
        if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js';
        script.async = true;
        document.body.appendChild(script);
        }
    }, []);
    // ... (useEffect de generatePixPayload sem alterações) ...
    useEffect(() => {
        if (isPaymentModalOpen && selectedPaymentMethod === 'Pix' && qrCanvasRef.current && window.QRious && orderToPay) {
            const payload = generatePixPayload(PIX_KEY, PIX_MERCHANT_NAME, PIX_MERCHANT_CITY, orderToPay.valor_total);
            setPixPayload(payload);

            new window.QRious({
                element: qrCanvasRef.current,
                value: payload,
                size: 220,
                padding: 20,
            });
        }
    }, [isPaymentModalOpen, selectedPaymentMethod, orderToPay, PIX_KEY, PIX_MERCHANT_NAME, PIX_MERCHANT_CITY]);
    
    // ... (copyToClipboard, fetchPedidos, useEffect de fetchPedidos, memos de pedidos sem alterações) ...
    const copyToClipboard = () => {
        navigator.clipboard.writeText(pixPayload).then(() => {
        setCopySuccess('Copiado!');
        setTimeout(() => setCopySuccess(''), 2000);
        }, () => {
        setCopySuccess('Falha ao copiar.');
        });
    };

    const fetchPedidos = async () => {
        try {
            const res = await fetch('/api/vendas/cozinha');
            if (!res.ok) throw new Error("Falha ao buscar pedidos da API.");
            const data = await res.json();
            setPedidos(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Erro ao buscar pedidos:", error);
            setPedidos([]); // Define como array vazio em caso de erro
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPedidos();
        const interval = setInterval(fetchPedidos, 15000); // Atualiza a cada 15 segundos
        return () => clearInterval(interval);
    }, []);

    const pedidosRecebidos = useMemo(() => pedidos.filter(p => p.status === 'Recebido'), [pedidos]);
    const pedidosEmProducao = useMemo(() => pedidos.filter(p => p.status === 'Em Produção'), [pedidos]);


    // --- Funções de manipulação de estado e API ---
    // 3. Remover a lógica de "Cancelado" desta função
    const handleUpdateStatus = async (pedidoId, newStatus, paymentMethod = null) => {
        try {
            let bodyData = { id: pedidoId, status: newStatus };
            if (newStatus === 'Pago' && paymentMethod) {
                bodyData.metodo_pagamento = paymentMethod;
            }

            const res = await fetch('/api/vendas/cozinha', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData),
            });
            if (!res.ok) {
                 const errorData = await res.json();
                 throw new Error(errorData.message || "Falha ao atualizar o estado do pedido.");
            }

            // Atualiza o estado local
            if (newStatus === 'Pago') { // Apenas 'Pago' remove da lista agora
                setPedidos(currentPedidos => currentPedidos.filter(p => p.id !== pedidoId));
                setIsSuccessModalOpen(true);
            } else { // Atualiza para 'Em Produção'
                setPedidos(currentPedidos => currentPedidos.map(p =>
                    p.id === pedidoId ? { ...p, status: newStatus } : p
                ));
            }

        } catch (error) {
            console.error("Erro em handleUpdateStatus:", error);
            setErrorMessage(error.message);
        }
    };

    // ... (openPaymentModal, handleAmountReceivedChange, handleConfirmPayment sem alterações) ...
    const openPaymentModal = (pedido) => {
        setOrderToPay(pedido);
        setSelectedPaymentMethod('Dinheiro'); 
        setCardType(null);
        setAmountReceived(''); 
        setChangeDue(0); 
        setErrorMessage(''); 
        setPixPayload(''); 
        setCopySuccess(''); 
        setIsPaymentModalOpen(true);
    };

    const handleAmountReceivedChange = (e) => {
        const value = e.target.value;
        const sanitizedValue = value.replace(/[^0-9.,]/g, '').replace(',', '.');
        setAmountReceived(value); 

        if (orderToPay && sanitizedValue !== '') {
            const received = parseFloat(sanitizedValue);
            if (!isNaN(received)) {
                const total = orderToPay.valor_total;
                setChangeDue(received - total); 
            } else {
                setChangeDue(0); 
            }
        } else {
            setChangeDue(0); 
        }
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

        if (selectedPaymentMethod === 'Dinheiro') {
             const received = parseFloat(String(amountReceived).replace(',', '.')); 
             if (isNaN(received) || received < orderToPay.valor_total) {
                 alert('O valor recebido é insuficiente ou inválido.'); 
                 return;
             }
        }

        handleUpdateStatus(orderToPay.id, 'Pago', finalPaymentMethod);

        setIsPaymentModalOpen(false);
        setOrderToPay(null);
    };
    
    // 4. Adicionar funções para controlar o modal de EXCLUSÃO
    const openDeleteModal = (pedido) => {
        setOrderToDelete(pedido);
        setDeleteError('');
        setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setOrderToDelete(null);
        setIsDeleteModalOpen(false);
    };

    // 5. Adicionar a função que REALMENTE EXCLUI
    const handleDeleteConfirm = async () => {
        if (!orderToDelete) return;
        
        setIsDeleting(true);
        setDeleteError('');

        try {
            // Chama a API de exclusão permanente
            const res = await fetch(`/api/vendas/${orderToDelete.id}`, {
                method: 'DELETE',
            });
            
            const responseData = await res.json();
            
            if (!res.ok) {
                throw new Error(responseData.message || "Falha ao excluir o pedido.");
            }

            // Sucesso: remover da lista local e fechar modal
            setPedidos(currentPedidos => currentPedidos.filter(p => p.id !== orderToDelete.id));
            closeDeleteModal();

        } catch (err) {
            setDeleteError(err.message);
        } finally {
            setIsDeleting(false);
        }
    };


    // --- Componente PedidoCard ---
    const PedidoCard = ({ pedido }) => {

        const handleProntoClick = () => {
            if (pedido.nome_cliente === 'PDV') {
                handleUpdateStatus(pedido.id, 'Pago');
            } else {
                openPaymentModal(pedido);
            }
        };

        return (
            <div key={pedido.id} className={`rounded-lg shadow-lg p-5 flex flex-col justify-between ${pedido.status === 'Recebido' ? 'bg-yellow-50' : 'bg-green-50'}`}>
                 <div>
                    <div className="flex justify-between items-start border-b pb-3 mb-3">
                        <div>
                            <p className="text-sm text-gray-600">Pedido #{pedido.id}</p>
                            <p className="font-bold text-xl text-gray-900">{pedido.nome_cliente}</p>
                        </div>
                        {/* 6. Atualizar o botão para chamar openDeleteModal */}
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${pedido.status === 'Recebido' ? 'bg-orange-200 text-orange-800' : 'bg-blue-200 text-blue-800'}`}>
                                {pedido.status}
                            </span>
                             <button
                            onClick={() => openDeleteModal(pedido)}
                            className="text-red-500 hover:text-red-700"
                            title="Excluir Pedido"
                        >
                            <Trash2 size={20} />
                        </button>
                        </div>
                    </div>
                    {/* ... (ul de itens, total, botões de ação sem alterações) ... */}
                    <ul className="space-y-2 mb-4">
                        {pedido.itens_venda && pedido.itens_venda.map((item, index) => (
                            <li key={index} className="flex justify-between items-center text-gray-800">
                                <span className="font-semibold">{item.quantidade}x</span>
                                <span>{item.produtos?.nome || 'Produto Indisponível'}</span>
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
                        onClick={handleProntoClick}
                        className="w-full mt-5 bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                        <Check size={20} />
                        {pedido.nome_cliente === 'PDV' ? 'Pedido Pronto' : 'Pedido Pronto / Pagar'}
                    </button>
                )}
            </div>
        );
    };

    // --- JSX Principal da Página ---
    return (
        <div className="min-h-screen bg-gradient-to-br from-[#3A3226] to-[#251a08] p-4 sm:p-6 lg:p-8 font-sans">
            {/* ... (cabeçalho, loading, seções de pedidos sem alterações) ... */}
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

            {/* --- Modal de Pagamento Aprimorado --- */}
            {/* ... (Modal 'isPaymentModalOpen' sem alterações) ... */}
            {isPaymentModalOpen && orderToPay && (
              <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm m-4 max-h-[90vh] overflow-y-auto">
                  {/* ... (conteúdo do modal de pagamento) ... */}
                   <h2 className="text-2xl font-bold mb-2 text-center">Finalizar Pedido #{orderToPay.id}</h2>
                  <p className="text-center text-xl font-semibold text-gray-800 mb-6">
                    Total: {Number(orderToPay.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <h3 className="text-lg font-semibold mb-3">Forma de Pagamento:</h3>
                  <div className="flex flex-col gap-3 mb-6">
                     {['Dinheiro', 'Pix'].map(method => (
                      <button
                          key={method}
                          onClick={() => { setSelectedPaymentMethod(method); setCardType(null); setAmountReceived(''); setChangeDue(0); }}
                          className={`w-full py-3 rounded-lg font-semibold text-lg border-2 ${selectedPaymentMethod === method ? 'bg-[#A16207] text-white border-[#A16207]' : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'}`}
                      >
                          {method}
                      </button>
                    ))}
                    <button
                        onClick={() => { setSelectedPaymentMethod('Cartão'); setAmountReceived(''); setChangeDue(0); setCardType(null);}} 
                        className={`w-full py-3 rounded-lg font-semibold text-lg border-2 ${selectedPaymentMethod === 'Cartão' ? 'bg-[#A16207] text-white border-[#A16207]' : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'}`}
                    >
                        Cartão
                    </button>
                    {selectedPaymentMethod === 'Cartão' && (
                        <div className="flex gap-3 animate-fade-in">
                            <button onClick={() => setCardType('Débito')} className={`w-full py-2 rounded-lg font-semibold border-2 ${cardType === 'Débito' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200'}`}>Débito</button>
                            <button onClick={() => setCardType('Crédito')} className={`w-full py-2 rounded-lg font-semibold border-2 ${cardType === 'Crédito' ? 'bg-purple-600 text-white border-purple-600' : 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200'}`}>Crédito</button>
                        </div>
                    )}
                  </div>
                  {selectedPaymentMethod === 'Dinheiro' && (
                    <div className="border-t pt-4 space-y-3 animate-fade-in">
                       <div>
                           <label htmlFor="amountReceived" className="block text-sm font-medium text-gray-700">Valor Recebido</label>
                           <div className="mt-1 relative rounded-md shadow-sm">
                               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                   <span className="text-gray-500 sm:text-sm">R$</span>
                               </div>
                               <input
                                   type="text"
                                   inputMode='decimal' 
                                   name="amountReceived"
                                   id="amountReceived"
                                   className="focus:ring-[#A16207] focus:border-[#A16207] block w-full pl-8 pr-3 py-2 sm:text-sm border-gray-300 rounded-md" 
                                   placeholder="0,00"
                                   value={amountReceived}
                                   onChange={handleAmountReceivedChange}
                               />
                           </div>
                       </div>
                       {(amountReceived && !isNaN(parseFloat(String(amountReceived).replace(',','.')))) && (changeDue !== 0 || parseFloat(String(amountReceived).replace(',','.')) < orderToPay.valor_total) && (
                           <div className={`text-center font-semibold text-lg p-2 rounded ${changeDue >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                               {changeDue >= 0 ? (
                                   `Troco: ${changeDue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                               ) : (
                                   `Faltam: ${Math.abs(changeDue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                               )}
                           </div>
                       )}
                    </div>
                  )}
                  {selectedPaymentMethod === 'Pix' && (
                      <div className="text-center border-t pt-4 animate-fade-in">
                          {/* ... (pix) ... */}
                      </div>
                  )}
                  <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                    <button onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancelar</button>
                    <button
                        onClick={handleConfirmPayment}
                        className={`px-4 py-2 bg-[#A16207] text-white rounded-lg font-bold hover:bg-[#8f5606] disabled:opacity-50 disabled:cursor-not-allowed`}
                        disabled={selectedPaymentMethod === 'Dinheiro' && (changeDue < 0 || amountReceived === '' || isNaN(parseFloat(String(amountReceived).replace(',','.'))))}
                    >
                      Confirmar Pagamento
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* --- Modais de Sucesso e Erro --- */}
            {/* ... (Modal 'isSuccessModalOpen' sem alterações) ... */}
            {isSuccessModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div className="bg-white p-10 rounded-lg shadow-xl w-full max-w-sm m-4 text-center">
                        <CheckCircle size={50} className="text-green-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2  text-gray-800">Pedido Pago com Sucesso!</h2>
                        <button onClick={() => setIsSuccessModalOpen(false)} className="mt-4 px-6 py-2 bg-gray-200 rounded-lg font-semibold hover:bg-gray-300  text-gray-800">
                            Fechar
                        </button>
                    </div>
                </div>
            )}
            {/* ... (Modal 'errorMessage' sem alterações) ... */}
            {errorMessage && (
              <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                  <div className="bg-white p-10 rounded-lg shadow-xl w-full max-w-sm m-4 text-center">
                      <XCircle size={50} className="text-red-500 mx-auto mb-4" />
                      <h2 className="text-xl font-bold mb-2">Erro</h2>
                      <p className="text-gray-600 mb-6">{errorMessage}</p>
                      <button onClick={() => setErrorMessage('')} className="px-6 py-2 bg-gray-200 rounded-lg font-semibold hover:bg-gray-300">
                          Fechar
                      </button>
                  </div>
              </div>
            )}

            {/* 7. Adicionar o JSX do modal de confirmação de EXCLUSÃO */}
            {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
              <div className="bg-white p-10 rounded-lg shadow-xl w-full max-w-sm m-4 text-center">
                  <Trash2 size={50} className="text-red-500 mx-auto mb-4" />
                  <h2 className="text-xl font-bold mb-2 text-gray-800 flex items-center justify-center gap-2">
                    <Trash2 size={22}/> Excluir Pedido?
                  </h2>
                      <p className="text-gray-600 mb-4">
                          Tem certeza que deseja excluir permanentemente o pedido #{orderToDelete?.id}?
                      </p>                      
                      {deleteError && (
                          <p className="text-red-600 mb-4">{deleteError}</p>
                      )}

                      <div className="flex justify-center gap-4">
                        <button 
                            onClick={closeDeleteModal} 
                            className="px-6 py-2 bg-gray-200 rounded-lg font-semibold"
                            disabled={isDeleting}
                        >
                            Voltar
                        </button>
                        <button 
                            onClick={handleDeleteConfirm} 
                            className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 flex items-center justify-center disabled:opacity-50"
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="animate-spin" size={20} /> : 'Excluir'}
                        </button>
                      </div>
                  </div>
              </div>
            )}
        </div>
    );
}