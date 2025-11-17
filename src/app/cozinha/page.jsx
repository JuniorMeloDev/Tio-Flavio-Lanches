'use client';

// Imports de React (useMemo adicionado)
import { useState, useEffect, useMemo, useRef } from 'react';
import { 
    ArrowLeft, ChefHat, Check, CookingPot, XCircle, Copy, CheckCircle, 
    DollarSign, Ban, Loader2, Trash2, Volume2, VolumeX, Percent 
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

// --- Função Auxiliar de Formatação (para Desconto e Valor Recebido) ---
const formatCurrencyInput = (value) => {
    if (!value) return '';
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly === '') return '';

    const numberValue = parseInt(digitsOnly, 10);
    const formattedValue = (numberValue / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return formattedValue;
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

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    
    // --- ESTADOS DE PAGAMENTO (COM DESCONTO) ---
    const [amountReceived, setAmountReceived] = useState('');
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [discount, setDiscount] = useState(''); // <-- ADICIONADO

    // --- MEMOS DE CÁLCULO (COM DESCONTO) ---
    const numericDiscount = useMemo(() => {
        return parseFloat(String(discount).replace(/\./g, '').replace(',', '.')) || 0;
    }, [discount]);

    const totalAfterDiscount = useMemo(() => {
        if (!orderToPay) return 0;
        const newTotal = orderToPay.valor_total - numericDiscount;
        return newTotal > 0 ? newTotal : 0;
    }, [orderToPay, numericDiscount]);

    const amountReceivedNumber = useMemo(() => {
        return parseFloat(String(amountReceived).replace(/\./g, '').replace(',', '.')) || 0;
    }, [amountReceived]);

    const changeDue = useMemo(() => {
        if (orderToPay && amountReceivedNumber > 0) {
            const total = totalAfterDiscount; // Usa o total com desconto
            return amountReceivedNumber - total;
        }
        return 0;
    }, [amountReceivedNumber, orderToPay, totalAfterDiscount]);

    // --- Estados de áudio ---
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
    const audioRef = useRef(null);
    const isPlaying = useRef(false);

    // --- Constantes PIX ---
    const PIX_KEY = process.env.NEXT_PUBLIC_PIX_KEY || '';
    const PIX_MERCHANT_NAME = process.env.NEXT_PUBLIC_PIX_MERCHANT_NAME;
    const PIX_MERCHANT_CITY = process.env.NEXT_PUBLIC_PIX_MERCHANT_CITY;

    // --- useEffects ---
    
    // Script do QRious
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
    
    // Gerador de PIX (agora depende do totalAfterDiscount)
    useEffect(() => {
        if (isPaymentModalOpen && selectedPaymentMethod === 'Pix' && qrCanvasRef.current && window.QRious && orderToPay) {
            const payload = generatePixPayload(PIX_KEY, PIX_MERCHANT_NAME, PIX_MERCHANT_CITY, totalAfterDiscount);
            setPixPayload(payload);

            new window.QRious({
                element: qrCanvasRef.current,
                value: payload,
                size: 220,
                padding: 20,
            });
        }
    }, [isPaymentModalOpen, selectedPaymentMethod, orderToPay, totalAfterDiscount, PIX_KEY, PIX_MERCHANT_NAME, PIX_MERCHANT_CITY]);
    
    const copyToClipboard = () => {
        navigator.clipboard.writeText(pixPayload).then(() => {
        setCopySuccess('Copiado!');
        setTimeout(() => setCopySuccess(''), 2000);
        }, () => {
        setCopySuccess('Falha ao copiar.');
        });
    };

    // Busca de Pedidos
    const fetchPedidos = async () => {
        try {
            const res = await fetch('/api/vendas/cozinha');
            if (!res.ok) throw new Error("Falha ao buscar pedidos da API.");
            const data = await res.json();
            const pedidosAtuais = Array.isArray(data) ? data : [];
            setPedidos(pedidosAtuais);

            const pedidosRecebidosCount = pedidosAtuais.filter(p => p.status === 'Recebido').length;
            if (pedidosRecebidosCount === 0 && isPlaying.current && audioRef.current) {
                console.log('COZINHA: Parando alarme, sem pedidos recebidos.');
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                isPlaying.current = false;
            }

        } catch (error) {
            console.error("Erro ao buscar pedidos:", error);
            setPedidos([]);
        } finally {
            setLoading(false);
        }
    };

    // Polling de Pedidos
    useEffect(() => {
        fetchPedidos();
        const interval = setInterval(fetchPedidos, 15000); 
        return () => clearInterval(interval);
    }, []);

    // --- Effects de áudio e SW (sem alterações) ---
    useEffect(() => {
        audioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
        audioRef.current.loop = true;
        audioRef.current.volume = 1.0;
    }, []);

    useEffect(() => {
        const unlockAudio = () => {
            if (!isAudioUnlocked && audioRef.current) {
                audioRef.current.play().then(() => {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                    setIsAudioUnlocked(true);
                    console.log("Áudio (Cozinha) desbloqueado.");
                    window.removeEventListener('click', unlockAudio, true);
                }).catch(() => {});
            }
        };
        window.addEventListener('click', unlockAudio, true);
        return () => window.removeEventListener('click', unlockAudio, true);
    }, [isAudioUnlocked]);
    
    useEffect(() => {
        async function initPush() {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
            const reg = await navigator.serviceWorker.register('/sw.js');
            if (Notification.permission === 'default') await Notification.requestPermission();
            if (Notification.permission !== 'granted') return;

            const res = await fetch('/api/push/vapid');
            const { publicKey } = await res.json();
            const convertedKey = urlBase64ToUint8Array(publicKey);

            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedKey,
            });

            await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sub),
            });
            
            console.log('Push (Cozinha) registrado!');
        }

        initPush();

        const handlePushMessage = (e) => {
            if (e.data?.type === 'NEW_ORDER') {
                console.log('COZINHA: Novo pedido recebido via Service Worker!');
                if (soundEnabled && isAudioUnlocked && audioRef.current) {
                    audioRef.current.loop = true;
                    audioRef.current.play().catch((err) => { console.warn("Falha ao tocar alarme:", err); });
                    isPlaying.current = true;
                }
                fetchPedidos();
            }
        };
        
        navigator.serviceWorker.addEventListener('message', handlePushMessage);

        function urlBase64ToUint8Array(base64String) {
            const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
            const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
            const rawData = atob(base64);
            return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
        }

        return () => {
            navigator.serviceWorker.removeEventListener('message', handlePushMessage);
        };
    }, [soundEnabled, isAudioUnlocked]);

    // Memos de Pedidos
    const pedidosRecebidos = useMemo(() => pedidos.filter(p => p.status === 'Recebido'), [pedidos]);
    const pedidosEmProducao = useMemo(() => pedidos.filter(p => p.status === 'Em Produção'), [pedidos]);


    // --- Funções de manipulação de estado e API ---

    // (MODIFICADO) Agora envia 'finalTotal' e 'discountAmount' para a API
    const handleUpdateStatus = async (pedidoId, newStatus, paymentMethod = null, finalTotal = null, discountAmount = null) => {
        try {
            let bodyData = { id: pedidoId, status: newStatus };
            
            if (newStatus === 'Pago' && paymentMethod) {
                bodyData.metodo_pagamento = paymentMethod;
                if (finalTotal !== null) {
                    bodyData.valor_total = finalTotal;
                }
                if (discountAmount !== null) {
                    bodyData.desconto = discountAmount; // API precisa ser ajustada
                }
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

            let pedidosAtualizados;
            if (newStatus === 'Pago') { 
                pedidosAtualizados = pedidos.filter(p => p.id !== pedidoId);
                setIsSuccessModalOpen(true);
            } else { 
                pedidosAtualizados = pedidos.map(p =>
                    p.id === pedidoId ? { ...p, status: newStatus } : p
                );
            }
            setPedidos(pedidosAtualizados);

            const pedidosRecebidosCount = pedidosAtualizados.filter(p => p.status === 'Recebido').length;
            if (pedidosRecebidosCount === 0 && isPlaying.current && audioRef.current) {
                console.log('COZINHA: Parando alarme, último pedido iniciado.');
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                isPlaying.current = false;
            }

        } catch (error) {
            console.error("Erro em handleUpdateStatus:", error);
            setErrorMessage(error.message);
        }
    };

    // (MODIFICADO) Reseta o 'discount' ao abrir
    const openPaymentModal = (pedido) => {
        setOrderToPay(pedido);
        setSelectedPaymentMethod('Dinheiro'); 
        setCardType(null);
        setAmountReceived(''); 
        setDiscount(''); // <-- ADICIONADO
        setErrorMessage(''); 
        setPixPayload(''); 
        setCopySuccess(''); 
        setIsProcessingPayment(false); 
        setIsPaymentModalOpen(true);
    };

    // Handler para o input "Valor Recebido"
    const handleAmountReceivedChange = (e) => {
        const formattedValue = formatCurrencyInput(e.target.value);
        setAmountReceived(formattedValue);
    };

    // --- ADICIONADO ---
    // Handler para o input "Desconto"
    const handleDiscountChange = (e) => {
        const formattedValue = formatCurrencyInput(e.target.value);
        setDiscount(formattedValue);
    };

    // (MODIFICADO) Confirma pagamento usando os memos de desconto
    const handleConfirmPayment = async () => {
        if (!orderToPay || isProcessingPayment) return;
        setIsProcessingPayment(true); 

        try {
            let finalPaymentMethod = selectedPaymentMethod;

            if (selectedPaymentMethod === 'Cartão') {
                if (!cardType) {
                    alert('Por favor, selecione Débito ou Crédito.'); 
                    setIsProcessingPayment(false);
                    return;
                }
                finalPaymentMethod = `Cartão - ${cardType}`;
            }

            if (selectedPaymentMethod === 'Dinheiro') {
                 if (amountReceivedNumber === 0 || amountReceivedNumber < totalAfterDiscount) {
                     alert('O valor recebido é insuficiente ou inválido.'); 
                     setIsProcessingPayment(false);
                     return;
                 }
            }

            await handleUpdateStatus(orderToPay.id, 'Pago', finalPaymentMethod, totalAfterDiscount, numericDiscount);

            setIsPaymentModalOpen(false);
            setOrderToPay(null);

        } catch (error) {
             console.error("Erro ao confirmar pagamento:", error);
             setErrorMessage(error.message || "Erro desconhecido ao pagar");
        } finally {
             setIsProcessingPayment(false);
        }
    };
    
    // ... (Funções handleToggleSound, openDeleteModal, etc. sem alteração) ...
    const handleToggleSound = () => {
        const isEnabling = !soundEnabled;
        setSoundEnabled(isEnabling);
        console.log(`Som da Cozinha ${isEnabling ? 'ATIVADO' : 'DESATIVADO'}.`);
        if (!isEnabling && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            isPlaying.current = false;
        }
    };

    const openDeleteModal = (pedido) => {
        setOrderToDelete(pedido);
        setDeleteError('');
        setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setOrderToDelete(null);
        setIsDeleteModalOpen(false);
    };

    const handleDeleteConfirm = async () => {
        if (!orderToDelete) return;
        
        setIsDeleting(true);
        setDeleteError('');

        try {
            const res = await fetch(`/api/vendas/${orderToDelete.id}`, {
                method: 'DELETE',
            });
            
            const responseData = await res.json();
            
            if (!res.ok) {
                throw new Error(responseData.message || "Falha ao excluir o pedido.");
            }

            setPedidos(currentPedidos => currentPedidos.filter(p => p.id !== orderToDelete.id));
            closeDeleteModal();

        } catch (err) {
            setDeleteError(err.message);
        } finally {
            setIsDeleting(false);
        }
    };


    // --- Componente PedidoCard (sem alterações) ---
    const PedidoCard = ({ pedido }) => {

        const handleProntoClick = () => {
            // A lógica de "PDV" original talvez precise ser ajustada
            // Agora estamos usando "Cliente Balcão"
            if (pedido.nome_cliente === 'PDV') {
                handleUpdateStatus(pedido.id, 'Pago', 'PDV', pedido.valor_total, 0);
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

    // --- JSX Principal da Página (Modal de Pagamento Atualizado) ---
    return (
        <div className="min-h-screen bg-gradient-to-br from-[#3A3226] to-[#251a08] p-4 sm:p-6 lg:p-8 font-sans">
            
            {/* ... (Botão de Som e Header) ... */}
            <div className="absolute top-4 right-4 z-20">
                <button
                    onClick={handleToggleSound}
                    className={`p-3 rounded-full text-white transition-colors ${soundEnabled ? 'bg-green-600/50' : 'bg-red-600/50'}`}
                    title={soundEnabled ? "Desativar som" : "Ativar som"}
                >
                    {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>
            </div>
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

            {/* ... (Grids de Pedidos) ... */}
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

            {/* --- MODAL DE PAGAMENTO (MODIFICADO COM DESCONTO) --- */}
            {isPaymentModalOpen && orderToPay && (
              <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm m-4 max-h-[90vh] overflow-y-auto">
                   
                   <h2 className="text-2xl font-bold mb-2 text-center text-gray-900">Finalizar Pedido #{orderToPay.id}</h2>
                   
                   {/* --- BLOCO DE DESCONTO ADICIONADO --- */}
                   <div className="border-y py-4 my-4 space-y-2">
                        <div className="flex justify-between text-gray-600">
                            <span>Subtotal</span>
                            <span>{Number(orderToPay.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <label htmlFor="discount" className="text-gray-600 flex items-center gap-1">
                                <span>Desconto</span>
                            </label>
                            <div className="relative rounded-md shadow-sm w-28">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-sm">R$</span>
                                </div>
                                <input
                                    type="text"
                                    inputMode='numeric'
                                    name="discount"
                                    id="discount"
                                    className="focus:ring-[#A16207] focus:border-[#A16207] block w-full pl-8 pr-3 py-1 sm:text-sm text-red-500 border-gray-300 rounded-md text-right"
                                    placeholder="0,00"
                                    value={discount}
                                    onChange={handleDiscountChange} // Conectado
                                />
                            </div>
                        </div>
                    </div>
                    {/* --- FIM DO BLOCO DE DESCONTO --- */}

                  <p className="text-center text-2xl font-bold text-gray-900 mb-6">
                    Total a Pagar: {totalAfterDiscount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">Forma de Pagamento:</h3>
                  {/* ... (Botões de Pagamento) ... */}
                  <div className="flex flex-col gap-3 mb-6">
                     {['Dinheiro', 'Pix'].map(method => (
                      <button
                          key={method}
                          onClick={() => { setSelectedPaymentMethod(method); setCardType(null); setAmountReceived(''); }}
                          className={`w-full py-3 rounded-lg font-semibold text-lg border-2 ${selectedPaymentMethod === method ? 'bg-[#A16207] text-white border-[#A16207]' : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'}`}
                      >
                          {method}
                      </button>
                    ))}
                    <button
                        onClick={() => { setSelectedPaymentMethod('Cartão'); setAmountReceived(''); setCardType(null);}} 
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
                  
                  {/* ... (Seção Dinheiro/Troco) ... */}
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
                                   inputMode='numeric' 
                                   name="amountReceived"
                                   id="amountReceived"
                                   className="focus:ring-[#A16207] focus:border-[#A16207] block w-full pl-8 pr-3 py-2 sm:text-sm border-gray-300 rounded-md" 
                                   placeholder="0,00"
                                   value={amountReceived}
                                   onChange={handleAmountReceivedChange}
                               />
                           </div>
                       </div>
                       {amountReceivedNumber > 0 && (
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

                  {/* ... (Seção PIX) ... */}
                  {selectedPaymentMethod === 'Pix' && (
                      <div className="text-center border-t pt-4 animate-fade-in">
                          <p className="font-semibold mb-2 text-gray-800">PIX ({totalAfterDiscount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</p>
                          <canvas ref={qrCanvasRef} className="mx-auto border"></canvas>
                          <p className="text-sm mt-2 text-gray-600">Ou use a chave "Copia e Cola":</p>
                          <div className="mt-1 flex items-center justify-between p-2 bg-gray-100 rounded-lg w-full">
                              <span className="text-gray-800 font-mono text-xs mr-2 overflow-hidden whitespace-nowrap text-ellipsis max-w-[calc(100%-40px)]">{pixPayload}</span>
                              <button onClick={copyToClipboard} className="bg-gray-200 p-1 rounded-md hover:bg-gray-300">
                                  {copySuccess ? <CheckCircle size={16} className="text-green-600"/> : <Copy size={16} />}
                              </button>
                          </div>
                      </div>
                  )}
                  
                  {/* ... (Botões Cancelar / Confirmar) ... */}
                  <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                    <button 
                        onClick={() => setIsPaymentModalOpen(false)} 
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                        disabled={isProcessingPayment}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirmPayment}
                        className={`px-4 py-2 bg-[#A16207] text-white rounded-lg font-bold hover:bg-[#8f5606] disabled:opacity-50 disabled:cursor-not-allowed`}
                        disabled={
                            isProcessingPayment ||
                            (selectedPaymentMethod === 'Dinheiro' && (amountReceivedNumber === 0 || amountReceivedNumber < totalAfterDiscount)) ||
                            (selectedPaymentMethod === 'Cartão' && !cardType)
                        }
                    >
                      {isProcessingPayment ? <Loader2 className="animate-spin" /> : 'Confirmar Pagamento'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* --- Modais de Sucesso, Erro e Exclusão (sem alterações) --- */}
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