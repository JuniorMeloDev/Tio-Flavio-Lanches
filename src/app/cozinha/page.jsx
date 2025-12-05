'use client';

// Imports de React
import { useState, useEffect, useMemo, useRef } from 'react';
import { 
    ArrowLeft, ChefHat, Check, CookingPot, XCircle, Copy, CheckCircle, 
    Ban, Loader2, Trash2, Volume2, VolumeX, Edit, Plus, Minus, Search, X
} from 'lucide-react';

// --- Funções para gerar o Payload do PIX (BR Code) ---
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

    const field26 = formatField('00', 'BR.GOV.BCB.PIX') + formatField('01', cleanKey);
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

const formatCurrencyInput = (value) => {
    if (!value) return '';
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly === '') return '';
    const numberValue = parseInt(digitsOnly, 10);
    return (numberValue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function CozinhaPage() {
    const [pedidos, setPedidos] = useState([]);
    const [products, setProducts] = useState([]); // Lista completa de produtos para edição
    const [loading, setLoading] = useState(true);
    
    // Estados Pagamento
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [orderToPay, setOrderToPay] = useState(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('Dinheiro');
    const [cardType, setCardType] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [pixPayload, setPixPayload] = useState('');
    const [copySuccess, setCopySuccess] = useState('');
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const qrCanvasRef = useRef(null);
    
    // Estados Edição
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [editCart, setEditCart] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Estados Exclusão
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    
    const [amountReceived, setAmountReceived] = useState('');
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [discount, setDiscount] = useState(''); 

    const [soundEnabled, setSoundEnabled] = useState(true);
    const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
    const audioRef = useRef(null);
    const isPlaying = useRef(false);

    const PIX_KEY = process.env.NEXT_PUBLIC_PIX_KEY || '';
    const PIX_MERCHANT_NAME = process.env.NEXT_PUBLIC_PIX_MERCHANT_NAME;
    const PIX_MERCHANT_CITY = process.env.NEXT_PUBLIC_PIX_MERCHANT_CITY;

    // --- Memos de Pagamento ---
    const numericDiscount = useMemo(() => parseFloat(String(discount).replace(/\./g, '').replace(',', '.')) || 0, [discount]);
    
    const totalAfterDiscount = useMemo(() => {
        if (!orderToPay) return 0;
        const newTotal = orderToPay.valor_total - numericDiscount;
        return newTotal > 0 ? newTotal : 0;
    }, [orderToPay, numericDiscount]);

    const amountReceivedNumber = useMemo(() => parseFloat(String(amountReceived).replace(/\./g, '').replace(',', '.')) || 0, [amountReceived]);
    
    const changeDue = useMemo(() => {
        if (orderToPay && amountReceivedNumber > 0) return amountReceivedNumber - totalAfterDiscount;
        return 0;
    }, [amountReceivedNumber, orderToPay, totalAfterDiscount]);

    // --- Memos de Edição ---
    const editTotal = useMemo(() => editCart.reduce((acc, item) => acc + (item.preco * item.quantity), 0), [editCart]);
    
    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        return products.filter(p => p.nome.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 5);
    }, [products, productSearch]);

    // --- UseEffects ---
    useEffect(() => {
        const scriptId = 'qrious-cdn';
        if (!document.getElementById(scriptId)) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js';
            script.async = true;
            document.body.appendChild(script);
        }
        // Carrega produtos para o modal de edição
        fetch('/api/produtos').then(res => res.json()).then(data => setProducts(data)).catch(console.error);
    }, []);
    
    useEffect(() => {
        if (isPaymentModalOpen && selectedPaymentMethod === 'Pix' && qrCanvasRef.current && window.QRious && orderToPay) {
            const payload = generatePixPayload(PIX_KEY, PIX_MERCHANT_NAME, PIX_MERCHANT_CITY, totalAfterDiscount);
            setPixPayload(payload);
            new window.QRious({ element: qrCanvasRef.current, value: payload, size: 220, padding: 20 });
        }
    }, [isPaymentModalOpen, selectedPaymentMethod, orderToPay, totalAfterDiscount, PIX_KEY, PIX_MERCHANT_NAME, PIX_MERCHANT_CITY]);
    
    const fetchPedidos = async () => {
        try {
            const res = await fetch('/api/vendas/cozinha');
            if (!res.ok) throw new Error("Falha ao buscar pedidos.");
            const data = await res.json();
            setPedidos(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Erro ao buscar pedidos:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPedidos();
        const interval = setInterval(fetchPedidos, 15000); 
        return () => clearInterval(interval);
    }, []);

    // --- Lógica de Edição ---
    const openEditModal = (pedido) => {
        setEditingOrder(pedido);
        // Mapeia os itens do pedido para o formato do carrinho de edição
        const items = pedido.itens_venda.map(item => ({
            id: item.produto_id,
            nome: item.produtos?.nome || 'Produto Desconhecido',
            preco: item.preco_unitario,
            quantity: item.quantidade
        }));
        setEditCart(items);
        setIsEditModalOpen(true);
    };

    const addToEditCart = (product) => {
        setEditCart(prev => {
            const exists = prev.find(item => item.id === product.id);
            if (exists) {
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { id: product.id, nome: product.nome, preco: product.preco, quantity: 1 }];
        });
        setProductSearch('');
    };

    const updateEditQuantity = (id, delta) => {
        setEditCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const saveEditOrder = async () => {
        if (!editingOrder) return;
        setIsSavingEdit(true);
        try {
            const res = await fetch(`/api/vendas/${editingOrder.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itens: editCart, total: editTotal })
            });
            if (!res.ok) throw new Error('Falha ao salvar alterações.');
            
            setIsEditModalOpen(false);
            setEditingOrder(null);
            fetchPedidos();
        } catch (error) {
            alert(error.message);
        } finally {
            setIsSavingEdit(false);
        }
    };

    // --- Lógica de Pagamento ---
    const handleUpdateStatus = async (pedidoId, newStatus, paymentMethod = null, finalTotal = null, discountAmount = null) => {
        try {
            let bodyData = { id: pedidoId, status: newStatus };
            if (newStatus === 'Pago' && paymentMethod) {
                bodyData.metodo_pagamento = paymentMethod;
                if (finalTotal !== null) bodyData.valor_total = finalTotal;
                if (discountAmount !== null) bodyData.desconto = discountAmount;
            }
            const res = await fetch('/api/vendas/cozinha', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData),
            });
            if (!res.ok) throw new Error("Falha ao atualizar pedido.");
            
            if (newStatus === 'Pago') { 
                setPedidos(current => current.filter(p => p.id !== pedidoId));
                setIsSuccessModalOpen(true);
            } else { 
                fetchPedidos();
            }
        } catch (error) {
            setErrorMessage(error.message);
        }
    };

    const openPaymentModal = (pedido) => {
        setOrderToPay(pedido);
        setSelectedPaymentMethod('Dinheiro'); 
        setCardType(null);
        setAmountReceived(''); 
        setDiscount(''); 
        setErrorMessage(''); 
        setPixPayload(''); 
        setIsPaymentModalOpen(true);
    };

    const handleConfirmPayment = async () => {
        if (!orderToPay || isProcessingPayment) return;
        setIsProcessingPayment(true); 
        try {
            let finalPaymentMethod = selectedPaymentMethod;
            if (selectedPaymentMethod === 'Cartão') {
                if (!cardType) { alert('Selecione Débito ou Crédito.'); setIsProcessingPayment(false); return; }
                finalPaymentMethod = `Cartão - ${cardType}`;
            }
            if (selectedPaymentMethod === 'Dinheiro') {
                 if (amountReceivedNumber === 0 || amountReceivedNumber < totalAfterDiscount) {
                     alert('Valor insuficiente.'); setIsProcessingPayment(false); return;
                 }
            }
            await handleUpdateStatus(orderToPay.id, 'Pago', finalPaymentMethod, totalAfterDiscount, numericDiscount);
            setIsPaymentModalOpen(false);
            setOrderToPay(null);
        } catch (error) {
             setErrorMessage(error.message);
        } finally {
             setIsProcessingPayment(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(pixPayload);
        setCopySuccess('Copiado!');
        setTimeout(() => setCopySuccess(''), 2000);
    };

    const openDeleteModal = (pedido) => { setOrderToDelete(pedido); setIsDeleteModalOpen(true); };
    const closeDeleteModal = () => { setOrderToDelete(null); setIsDeleteModalOpen(false); };
    const handleDeleteConfirm = async () => {
        if (!orderToDelete) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/vendas/${orderToDelete.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error("Falha ao excluir.");
            setPedidos(curr => curr.filter(p => p.id !== orderToDelete.id));
            closeDeleteModal();
        } catch (err) { setDeleteError(err.message); } finally { setIsDeleting(false); }
    };

    // Componente Card
    const PedidoCard = ({ pedido }) => {
        return (
            <div key={pedido.id} className={`rounded-lg shadow-lg p-5 flex flex-col justify-between ${pedido.status === 'Recebido' ? 'bg-yellow-50' : 'bg-green-50'}`}>
                 <div>
                    <div className="flex justify-between items-start border-b pb-3 mb-3">
                        <div>
                            <p className="text-sm text-gray-600">Pedido #{pedido.id}</p>
                            <p className="font-bold text-xl text-gray-900">{pedido.nome_cliente}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${pedido.status === 'Recebido' ? 'bg-orange-200 text-orange-800' : 'bg-blue-200 text-blue-800'}`}>
                                {pedido.status}
                            </span>
                             <button onClick={() => openDeleteModal(pedido)} className="text-red-500 hover:text-red-700" title="Excluir">
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>
                    <ul className="space-y-2 mb-4">
                        {pedido.itens_venda && pedido.itens_venda.map((item, index) => (
                            <li key={index} className="flex justify-between items-center text-gray-800">
                                <span className="font-semibold">{item.quantidade}x</span>
                                <span>{item.produtos?.nome || 'Desconhecido'}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="border-t pt-2 flex justify-between font-bold text-lg text-gray-900">
                        <span>Total:</span>
                        <span>{Number(pedido.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                </div>

                {/* BOTÕES ALTERADOS AQUI */}
                {pedido.status === 'Recebido' ? (
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={() => openEditModal(pedido)}
                            className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                        >
                            <Edit size={18} /> Editar
                        </button>
                        <button
                            onClick={() => openPaymentModal(pedido)}
                            className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700 flex items-center justify-center gap-2"
                        >
                            <Check size={18} /> Pagar
                        </button>
                    </div>
                ) : ( 
                    <button
                        onClick={() => openPaymentModal(pedido)}
                        className="w-full mt-5 bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700 flex items-center justify-center gap-2">
                        <Check size={20} /> Pedido Pronto / Pagar
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#3A3226] to-[#251a08] p-4 sm:p-6 lg:p-8 font-sans">
            {/* Header */}
            <div className="absolute top-4 right-4 z-20">
                {/* <button onClick={() => setSoundEnabled(!soundEnabled)} className={`p-3 rounded-full text-white ${soundEnabled ? 'bg-green-600/50' : 'bg-red-600/50'}`}>
                    {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button> */}
            </div>
            <div className="max-w-7xl mx-auto">
                 <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3"><ChefHat size={32} /> Pedidos</h1>
                    <a href="/" className="flex items-center gap-2 px-4 py-2 bg-[#A16207] text-white rounded-lg font-semibold hover:bg-[#8f5606]"><ArrowLeft size={18} /> Voltar</a>
                </div>

                {loading && <p className="text-center text-gray-300">A carregar pedidos...</p>}
                
                <div className="space-y-8">
                    {/* Novos Pedidos */}
                    {pedidos.filter(p => p.status === 'Recebido').length > 0 && (
                        <div>
                            <h2 className="text-xl font-semibold text-yellow-300 mb-4">Novos Pedidos</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {pedidos.filter(p => p.status === 'Recebido').map(p => <PedidoCard key={p.id} pedido={p} />)}
                            </div>
                        </div>
                    )}
                    {/* Em Produção (caso ainda use) */}
                    {pedidos.filter(p => p.status === 'Em Produção').length > 0 && (
                        <div>
                            <h2 className="text-xl font-semibold text-blue-300 mb-4">Em Produção</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {pedidos.filter(p => p.status === 'Em Produção').map(p => <PedidoCard key={p.id} pedido={p} />)}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL DE EDIÇÃO DE PEDIDO */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900">Editar Pedido #{editingOrder?.id}</h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-500"><X size={24}/></button>
                        </div>
                        
                        {/* Busca de Produtos */}
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Adicionar produto..." 
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-800"
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                            />
                            {productSearch && (
                                <div className="absolute top-full left-0 right-0 bg-white border mt-1 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                                    {filteredProducts.map(p => (
                                        <div key={p.id} onClick={() => addToEditCart(p)} className="p-2 hover:bg-gray-100 cursor-pointer text-gray-800 flex justify-between">
                                            <span>{p.nome}</span>
                                            <span className="text-gray-500">R$ {Number(p.preco).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Lista de Itens */}
                        <div className="flex-1 overflow-y-auto mb-4 border-t border-b py-2">
                            {editCart.map(item => (
                                <div key={item.id} className="flex justify-between items-center mb-3">
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-800">{item.nome}</p>
                                        <p className="text-xs text-gray-500">Unit: R$ {Number(item.preco).toFixed(2)}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => updateEditQuantity(item.id, -1)} className="p-1 bg-gray-200 rounded text-gray-700"><Minus size={14}/></button>
                                        <span className="font-bold text-gray-800 w-6 text-center">{item.quantity}</span>
                                        <button onClick={() => updateEditQuantity(item.id, 1)} className="p-1 bg-gray-200 rounded text-gray-700"><Plus size={14}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between items-center mb-4">
                            <span className="font-bold text-lg text-gray-900">Novo Total:</span>
                            <span className="font-bold text-xl text-blue-600">{editTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>

                        <button 
                            onClick={saveEditOrder} 
                            disabled={isSavingEdit}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {isSavingEdit ? <Loader2 className="animate-spin" /> : 'Salvar Alterações'}
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL DE PAGAMENTO (CÓDIGO EXISTENTE ATUALIZADO) */}
            {isPaymentModalOpen && orderToPay && (
              <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm m-4 max-h-[90vh] overflow-y-auto">
                   <h2 className="text-2xl font-bold mb-2 text-center text-gray-900">Pagamento Pedido #{orderToPay.id}</h2>
                   
                   <div className="border-y py-4 my-4 space-y-2">
                        <div className="flex justify-between text-gray-600">
                            <span>Subtotal</span>
                            <span>{Number(orderToPay.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <label className="text-gray-600">Desconto</label>
                            <input type="text" className="w-24 border rounded p-1 text-right text-gray-800" placeholder="0,00" value={discount} onChange={e => setDiscount(formatCurrencyInput(e.target.value))} />
                        </div>
                    </div>

                  <p className="text-center text-2xl font-bold text-gray-900 mb-6">
                    Total: {totalAfterDiscount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  
                  <div className="flex flex-col gap-3 mb-4">
                     {['Dinheiro', 'Pix', 'Cartão'].map(method => (
                      <button key={method} onClick={() => { setSelectedPaymentMethod(method); setCardType(null); }}
                          className={`w-full py-3 rounded-lg font-semibold border-2 ${selectedPaymentMethod === method ? 'bg-[#A16207] text-white border-[#A16207]' : 'bg-gray-100 text-gray-800'}`}>
                          {method}
                      </button>
                    ))}
                    {selectedPaymentMethod === 'Cartão' && (
                        <div className="flex gap-2">
                            <button onClick={() => setCardType('Débito')} className={`flex-1 py-2 rounded border ${cardType === 'Débito' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'}`}>Débito</button>
                            <button onClick={() => setCardType('Crédito')} className={`flex-1 py-2 rounded border ${cardType === 'Crédito' ? 'bg-purple-600 text-white' : 'bg-white text-gray-800'}`}>Crédito</button>
                        </div>
                    )}
                  </div>
                  
                  {selectedPaymentMethod === 'Dinheiro' && (
                    <div className="mb-4">
                       <label className="block text-sm text-gray-700">Valor Recebido</label>
                       <input type="text" className="w-full border rounded p-2 text-gray-800" placeholder="0,00" value={amountReceived} onChange={e => setAmountReceived(formatCurrencyInput(e.target.value))} />
                       {amountReceivedNumber > 0 && <p className={`text-center font-bold mt-2 ${changeDue >= 0 ? 'text-green-600' : 'text-red-600'}`}>{changeDue >= 0 ? `Troco: R$ ${changeDue.toFixed(2)}` : `Faltam: R$ ${Math.abs(changeDue).toFixed(2)}`}</p>}
                    </div>
                  )}

                  {selectedPaymentMethod === 'Pix' && (
                      <div className="text-center mb-4">
                          <canvas ref={qrCanvasRef} className="mx-auto border mb-2"></canvas>
                          <div className="flex items-center bg-gray-100 p-2 rounded">
                              <span className="text-xs truncate flex-1 text-gray-600">{pixPayload}</span>
                              <button onClick={copyToClipboard}><Copy size={16} className="text-gray-500"/></button>
                          </div>
                      </div>
                  )}
                  
                  <div className="flex gap-3">
                    <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-2 bg-gray-200 text-gray-800 rounded">Cancelar</button>
                    <button onClick={handleConfirmPayment} disabled={isProcessingPayment} className="flex-1 py-2 bg-[#A16207] text-white rounded font-bold">
                        {isProcessingPayment ? <Loader2 className="animate-spin mx-auto"/> : 'Confirmar'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modais auxiliares (Sucesso, Delete, Erro) mantidos igual ao original, omitidos aqui para brevidade se não houve alteração lógica, mas devem estar no arquivo final */}
            {isSuccessModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-lg text-center">
                        <CheckCircle size={50} className="text-green-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Pago com Sucesso!</h2>
                        <button onClick={() => setIsSuccessModalOpen(false)} className="px-6 py-2 bg-gray-200 rounded text-gray-800">Fechar</button>
                    </div>
                </div>
            )}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-lg text-center max-w-sm">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Excluir Pedido?</h2>
                        <p className="text-gray-600 mb-6">Tem certeza? Isso restaurará o estoque.</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={closeDeleteModal} className="px-4 py-2 bg-gray-200 rounded text-gray-800">Cancelar</button>
                            <button onClick={handleDeleteConfirm} className="px-4 py-2 bg-red-600 text-white rounded">Excluir</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}