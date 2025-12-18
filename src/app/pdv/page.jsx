'use client';

import { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, ArrowLeft, XCircle, CheckCircle, X, Ban, Plus, User, Printer } from 'lucide-react';

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
                ${venda.itens.map(item => `
                    <div style="display: flex; justify-content: space-between; align-items-flex-start; margin-bottom: 3px;">
                        <span style="max-width: 200px;">${item.produtos.nome} (${item.quantidade}x)</span>
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
    printWindow.document.write(`<html><head><title>Comprovante</title></head><body style="margin:0; padding:0;">${receiptContent}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
};


/**
 * --- COMPONENTE DO CARRINHO (MODIFICADO) ---
 * 'total' agora vem direto do 'useMemo' simples.
 */
const CartComponent = ({
    isMobile, cart, total, customerName, setCustomerName,
    setIsCartOpenMobile, removeFromCart, handleSendToKitchen, isProcessingPayment, setErrorMessage
}) => (
    <div className={`p-6 flex flex-col h-full bg-white w-full`}>
        {/* ... (cabeçalho e input de nome) ... */}
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <ShoppingCart /> Carrinho
            </h2>
            {isMobile && (
                <button onClick={() => setIsCartOpenMobile(false)} className="text-gray-500 hover:text-gray-800">
                    <X size={24} />
                </button>
            )}
        </div>
        <div className="mb-4">
            <label htmlFor="customerName" className="block text-sm font-medium text-gray-700">Nome do Cliente</label>
            <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="text-gray-400" size={16} />
                </div>
                <input
                    type="text"
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Opcional (Ex: Cliente Balcão)"
                    className="w-full p-2 pl-10 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#A16207]"
                />
            </div>
        </div>

        {/* ... (lista de itens do carrinho) ... */}
        <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
                <p className="text-gray-500">O carrinho está vazio.</p>
            ) : (
                cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center mb-3">
                        <div>
                            <p className="font-semibold text-gray-800">{item.nome}</p>
                            <p className="text-sm text-gray-500">{item.quantity} x R$ {Number(item.preco).toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <p className="font-bold text-gray-800">R$ {(item.preco * item.quantity).toFixed(2)}</p>
                            <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700">
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>

        <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4">
                <span className="text-xl font-bold text-gray-800">Total</span>
                {/* Total agora é o total simples, sem desconto */}
                <span className="text-2xl font-bold text-[#A16207]">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
            <button
                onClick={() => {
                    if (cart.length > 0) { handleSendToKitchen(); }
                    else { setErrorMessage('Adicione itens ao carrinho para enviar o pedido.'); }
                }}
                className="w-full bg-[#A16207] text-white py-3 rounded-lg font-bold text-lg hover:bg-[#8f5606] transition-colors disabled:bg-gray-400 disabled:opacity-70"
                disabled={cart.length === 0 || isProcessingPayment}
            >
                {isProcessingPayment ? 'Enviando...' : 'Enviar para Cozinha'}
            </button>
        </div>
    </div>
);


export default function PdvPage() {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);

    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [isCartOpenMobile, setIsCartOpenMobile] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

    const [activeCategory, setActiveCategory] = useState('');
    const [categories, setCategories] = useState([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [variationModalProduct, setVariationModalProduct] = useState(null);

    const [customerName, setCustomerName] = useState('');

    // --- ESTADO DE DESCONTO REMOVIDO ---
    // const [discount, setDiscount] = useState('');

    const [lastSaleDataForReceipt, setLastSaleDataForReceipt] = useState(null);

    // Categories are now dynamic


    // --- CÁLCULOS DE TOTAIS (SIMPLIFICADO) ---
    const total = useMemo(() => cart.reduce((acc, item) => acc + item.preco * item.quantity, 0), [cart]);

    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/categorias');
            if (res.ok) {
                const data = await res.json();
                setCategories(data || []);
                // Se não tiver categoria ativa e tivermos categorias carregadas, setar a primeira
                if (data && data.length > 0 && !activeCategory) {
                    setActiveCategory(data[0].nome);
                }
            }
        } catch (error) {
            console.error("Erro ao buscar categorias:", error);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await fetch('/api/produtos');
            if (!res.ok) throw new Error('Falha ao carregar produtos da API.');
            const data = await res.json(); setProducts(data);
        } catch (error) { console.error("Erro ao buscar produtos:", error); setErrorMessage(error.message); }
    };

    useEffect(() => {
        fetchCategories();
        fetchProducts();
    }, []);

    // Atualizar activeCategory quando categories carregar (caso inicial)
    useEffect(() => {
        if (!activeCategory && categories.length > 0) {
            setActiveCategory(categories[0].nome);
        }
    }, [categories, activeCategory]);

    const processedProducts = useMemo(() => {
        let filtered = searchTerm
            ? products.filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase()))
            : products.filter(p => p.categoria === activeCategory);

        const parents = {};
        const standalone = [];

        filtered.forEach(product => {
            if (product.nome.includes(':')) {
                const [parentName, variationName] = product.nome.split(':').map(s => s.trim());
                if (!parents[parentName]) {
                    parents[parentName] = {
                        isParent: true,
                        nome: parentName,
                        variations: [],
                        categoria: product.categoria
                    };
                }
                parents[parentName].variations.push({ ...product, variationName });
            } else {
                standalone.push(product);
            }
        });

        Object.values(parents).forEach(parent => {
            if (parent.variations.length > 0) {
                parent.preco = Math.min(...parent.variations.map(v => v.preco));
                parent.variations.sort((a, b) => a.variationName.localeCompare(b.variationName));
            } else {
                parent.preco = 0;
            }
        });

        const combined = [...Object.values(parents), ...standalone];
        combined.sort((a, b) => a.nome.localeCompare(b.nome));
        return combined;
    }, [products, activeCategory, searchTerm]);

    const handleFilterCategory = (category) => {
        setActiveCategory(category);
        setSearchTerm('');
    };

    const handleProductClick = (product) => {
        if (product.isParent) { setVariationModalProduct(product); }
        else { addToCart(product); }
    };

    const addToCart = (product) => {
        if (product.quantidade_estoque <= 0) { setErrorMessage(`Produto "${product.nome}" esgotado.`); return; }
        setCart((prevCart) => {
            const existingItem = prevCart.find((item) => item.id === product.id);
            if (existingItem && existingItem.quantity >= product.quantidade_estoque) {
                setErrorMessage(`Limite de estoque para "${product.nome}" atingido.`); return prevCart;
            }
            if (existingItem) {
                return prevCart.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prevCart, { ...product, quantity: 1 }];
        });
    };

    const removeFromCart = (productId) => {
        setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
    };

    const handleSendToKitchen = async () => {
        if (cart.length === 0) {
            setErrorMessage('O carrinho está vazio.');
            return;
        }
        if (isProcessingPayment) return;
        setIsProcessingPayment(true);

        const saleData = {
            itens: cart.map(item => ({
                id: item.id,
                quantity: item.quantity,
                preco: item.preco,
                preco_custo: item.preco_custo,
                nome: item.nome
            })),
            total: total, // MODIFICADO: Era totalAfterDiscount
            metodo_pagamento: "Pendente",
            nome_cliente: customerName.trim() || 'Cliente Balcão',
            custo_pagamento: 0
        };

        try {
            const res = await fetch('/api/vendas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saleData)
            });

            const responseData = await res.json();
            if (!res.ok) {
                throw new Error(responseData.message || 'Ocorreu um erro ao registrar a venda.');
            }

            const receiptData = {
                id: responseData.venda_id,
                criado_em: new Date().toISOString(),
                itens: cart.map(item => ({
                    produtos: { nome: item.nome },
                    quantidade: item.quantity,
                    preco_unitario: item.preco
                })),
                valor_subtotal: total,
                desconto: 0, // MODIFICADO: Era numericDiscount
                valor_total: total, // MODIFICADO: Era totalAfterDiscount
                metodo_pagamento: "Pendente"
            };
            setLastSaleDataForReceipt(receiptData);

            setIsSuccessModalOpen(true);
            setIsCartOpenMobile(false);
            setCart([]);
            setCustomerName('');
            // setDiscount(''); // REMOVIDO
            fetchProducts();
        } catch (error) {
            setErrorMessage(error.message);
        } finally {
            setIsProcessingPayment(false);
        }
    };

    const closeSuccessModal = () => {
        setIsSuccessModalOpen(false);
        setLastSaleDataForReceipt(null);
    };

    const handlePrintAndClose = () => {
        if (lastSaleDataForReceipt) {
            generateAndPrintReceipt(lastSaleDataForReceipt);
        }
        closeSuccessModal();
    };

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

            console.log('Push registrado com sucesso!');
        }

        initPush();

        navigator.serviceWorker.addEventListener('message', (e) => {
            if (e.data?.type === 'NEW_ORDER') {
                const audio = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
                audio.play().catch(() => { });
            }
        });

        function urlBase64ToUint8Array(base64String) {
            const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
            const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
            const rawData = atob(base64);
            return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
        }
    }, []);


    return (
        <div className="relative flex flex-col md:flex-row h-screen bg-gradient-to-br from-[#3A3226] to-[#251a08] font-sans overflow-hidden">
            {/* ... (Coluna da Esquerda - Produtos - sem alteração) ... */}
            <div className="p-6 flex flex-col flex-1 min-h-0">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-white">Ponto de Venda</h1>
                    <a href="/" className="flex items-center gap-2 px-4 py-2 bg-[#A16207] text-white rounded-lg font-semibold hover:bg-[#8f5606] transition-colors">
                        <ArrowLeft size={18} /> Voltar ao Início
                    </a>
                </div>
                <div className="mb-4">
                    <input
                        type="text" placeholder="Buscar produto por nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-3 border rounded-lg bg-white/10 text-white placeholder-gray-300 border-white/20 focus:outline-none focus:ring-2 focus:ring-[#A16207]"
                    />
                </div>
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {categories.map(category => (
                        <button
                            key={category.id} onClick={() => handleFilterCategory(category.nome)}
                            className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap ${activeCategory === category.nome && !searchTerm ? 'bg-[#A16207] text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}
                        >
                            {category.nome}
                        </button>
                    ))}
                    {categories.length === 0 && <span className="text-gray-400">Carregando categorias...</span>}
                </div>
                <div className="flex-1 overflow-y-auto pr-2 min-h-0">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {processedProducts.map((product) => {
                            const isOutOfStock = product.isParent ? product.variations.every(v => v.quantidade_estoque <= 0) : product.quantidade_estoque <= 0;
                            return (
                                <button key={product.nome} title={isOutOfStock ? `${product.nome} (Esgotado)` : product.nome}
                                    onClick={() => handleProductClick(product)} disabled={isOutOfStock}
                                    className={`relative bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow hover:shadow-lg transition-all text-left flex flex-col justify-between h-28 ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}>
                                    {isOutOfStock && (<div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg"><span className="text-white font-bold text-lg">ESGOTADO</span></div>)}
                                    <span className="font-semibold text-[#422006] break-words line-clamp-2">{product.nome}</span>
                                    <span className="text-[#654321]">{product.isParent ? `A partir de R$ ${Number(product.preco).toFixed(2)}` : `R$ ${Number(product.preco).toFixed(2)}`}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="hidden md:flex md:w-[450px] md:flex-shrink-0 shadow-lg">
                <CartComponent
                    isMobile={false}
                    cart={cart}
                    total={total}
                    customerName={customerName}
                    setCustomerName={setCustomerName}
                    removeFromCart={removeFromCart}
                    handleSendToKitchen={handleSendToKitchen}
                    isProcessingPayment={isProcessingPayment}
                    setErrorMessage={setErrorMessage}
                />
            </div>

            {cart.length > 0 && (
                <div className="md:hidden fixed bottom-4 right-4 z-40">
                    <button onClick={() => setIsCartOpenMobile(true)} className="bg-[#A16207] text-white rounded-full p-4 shadow-lg flex items-center justify-center gap-3">
                        <ShoppingCart size={24} />
                        <span className="font-bold">Ver Carrinho ({cart.reduce((acc, item) => acc + item.quantity, 0)})</span>
                        <span className="font-bold">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </button>
                </div>
            )}
            {isCartOpenMobile && (
                <div className="md:hidden fixed inset-0 z-50 bg-white">
                    <CartComponent
                        isMobile={true}
                        cart={cart}
                        total={total}
                        customerName={customerName}
                        setCustomerName={setCustomerName}
                        removeFromCart={removeFromCart}
                        setIsCartOpenMobile={setIsCartOpenMobile}
                        handleSendToKitchen={handleSendToKitchen}
                        isProcessingPayment={isProcessingPayment}
                        setErrorMessage={setErrorMessage}
                    />
                </div>
            )}

            {variationModalProduct && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-gray-900">{variationModalProduct.nome}</h2>
                            <button onClick={() => setVariationModalProduct(null)} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
                        </div>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                            {variationModalProduct.variations.map(variation => {
                                const isOutOfStock = variation.quantidade_estoque <= 0;
                                return (
                                    <div key={variation.id} className={`flex justify-between items-center p-3 rounded-lg ${isOutOfStock ? 'bg-gray-100 opacity-60' : 'bg-gray-50'}`}>
                                        <div>
                                            <p className="font-semibold text-gray-800">{variation.variationName}</p>
                                            <p className="text-sm text-gray-600">R$ {Number(variation.preco).toFixed(2)}</p>
                                        </div>
                                        {isOutOfStock ? (<span className="font-bold text-red-500 text-sm">ESGOTADO</span>) : (
                                            <button onClick={() => { addToCart(variation); setVariationModalProduct(null); }}
                                                className="bg-[#A16207] text-white rounded-full w-9 h-9 flex items-center justify-center transition-transform hover:scale-110">
                                                <Plus size={22} />
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {isSuccessModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div className="bg-white p-10 rounded-lg shadow-xl w-full max-w-sm m-4 text-center">
                        <CheckCircle size={50} className="text-green-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2  text-gray-800">Pedido Enviado!</h2>
                        <p className="text-gray-700 mb-6">
                            Deseja imprimir o comprovante do pedido?
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handlePrintAndClose}
                                className="w-full bg-[#A16207] text-white py-3 rounded-lg font-semibold hover:bg-[#8f5606] flex items-center justify-center gap-2"
                            >
                                <Printer size={18} />
                                Sim, Imprimir
                            </button>
                            <button
                                onClick={closeSuccessModal}
                                className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg font-semibold hover:bg-gray-300"
                            >
                                Não (Nova Venda)
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {errorMessage && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div className="bg-white p-10 rounded-lg shadow-xl w-full max-w-sm m-4 text-center">
                        <Ban size={50} className="text-yellow-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">Atenção</h2>
                        <p className="text-gray-600 mb-6">
                            {errorMessage}
                        </p>
                        <button onClick={() => setErrorMessage('')} className="px-6 py-2 bg-gray-200 rounded-lg font-semibold">
                            Fechar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}