'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ShoppingCart, Plus, Minus, CheckCircle, XCircle, Ban, ChevronDown, ChevronUp, Copy } from 'lucide-react';

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
    // Garantindo que a chave PIX, nome e cidade sejam seguros para o BR Code
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


export default function CardapioPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [openVariations, setOpenVariations] = useState({});
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('Pix');
  const [cardType, setCardType] = useState(null);
  const [pixPayload, setPixPayload] = useState('');
  const [copySuccess, setCopySuccess] = useState('');
  const qrCanvasRef = useRef(null);

  const PIX_KEY = process.env.NEXT_PUBLIC_PIX_KEY || 'CHAVE-PIX-DE-TESTE';
  const PIX_MERCHANT_NAME = process.env.NEXT_PUBLIC_PIX_MERCHANT_NAME || 'Tio Flavio Lanches';
  const PIX_MERCHANT_CITY = process.env.NEXT_PUBLIC_PIX_MERCHANT_CITY || 'JABOATAO';

  const total = useMemo(() => cart.reduce((acc, item) => acc + item.preco * item.quantity, 0), [cart]);
  const totalItems = useMemo(() => cart.reduce((acc, item) => acc + item.preco * item.quantity, 0), [cart]);

  // Efeito para carregar a biblioteca de QR Code e gerar o código
  useEffect(() => {
    // 1. Injeta o script qrious (CDN) se não estiver presente
    const scriptId = 'qrious-cdn';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (isPaymentModalOpen && selectedPaymentMethod === 'Pix' && qrCanvasRef.current && window.QRious) {
        const payload = generatePixPayload(PIX_KEY, PIX_MERCHANT_NAME, PIX_MERCHANT_CITY, total);
        setPixPayload(payload);
        
        // 2. Gera QR Code usando o objeto global QRious
        new window.QRious({
            element: qrCanvasRef.current,
            value: payload,
            size: 220,
            padding: 20,
        });
    }
  }, [isPaymentModalOpen, selectedPaymentMethod, total, PIX_KEY, PIX_MERCHANT_NAME, PIX_MERCHANT_CITY]);


  const copyToClipboard = () => {
    // Copia o Payload PIX completo, que é o BR Code
    navigator.clipboard.writeText(pixPayload).then(() => {
      setCopySuccess('Copiado!');
      setTimeout(() => setCopySuccess(''), 2000);
    }, () => {
      setCopySuccess('Falha ao copiar.');
    });
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/produtos');
      if (!res.ok) throw new Error('Falha ao carregar o cardápio');
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const processedMenu = useMemo(() => {
    const parents = {};
    const standalone = {};
    products.forEach(product => {
      if (product.nome.includes(':')) {
        const [parentName, variationName] = product.nome.split(':').map(s => s.trim());
        if (!parents[parentName]) parents[parentName] = { categoria: product.categoria, variations: [] };
        parents[parentName].variations.push({ ...product, variationName });
      } else {
        if (!standalone[product.categoria]) standalone[product.categoria] = [];
        standalone[product.categoria].push(product);
      }
    });
    const finalMenu = {};
    for(const parentName in parents){
        const item = parents[parentName];
        if(!finalMenu[item.categoria]) finalMenu[item.categoria] = [];
        const minPrice = Math.min(...item.variations.map(v => v.preco));
        item.variations.sort((a, b) => a.preco - b.preco);
        finalMenu[item.categoria].push({ isParent: true, nome: parentName, preco: minPrice, descricao: item.variations[0]?.descricao, ...item });
    }
    for(const category in standalone){
         if(!finalMenu[category]) finalMenu[category] = [];
        finalMenu[category].push(...standalone[category]);
    }
    for (const category in finalMenu) {
        finalMenu[category].sort((a, b) => a.nome.localeCompare(b.nome));
    }
    return finalMenu;
  }, [products]);

  const updateCart = (product, quantity) => {
    if (quantity > product.quantidade_estoque) {
        setErrorMessage(`Desculpe, só temos ${product.quantidade_estoque} unidades de "${product.nome}" em estoque.`);
        return;
    }
    setCart(currentCart => {
      const itemIndex = currentCart.findIndex(item => item.id === product.id);
      if (quantity <= 0) {
        if (itemIndex > -1) return currentCart.filter(item => item.id !== product.id);
        return currentCart;
      }
      if (itemIndex > -1) {
        const newCart = [...currentCart];
        newCart[itemIndex].quantity = quantity;
        return newCart;
      }
      return [...currentCart, { ...product, quantity }];
    });
  };

  const handleConfirmPayment = async () => {
    if (!customerName.trim()) {
      setErrorMessage("Por favor, insira o seu nome para identificação.");
      return;
    }
    let finalPaymentMethod = selectedPaymentMethod;
    if (selectedPaymentMethod === 'Cartão') {
        if (!cardType) { setErrorMessage('Por favor, selecione Débito ou Crédito.'); return; }
        finalPaymentMethod = `Cartão - ${cardType}`;
    }
    const saleData = {
      itens: cart.map(item => ({ id: item.id, quantity: item.quantity, preco: item.preco, preco_custo: item.preco_custo, nome: item.nome })),
      total: total,
      metodo_pagamento: finalPaymentMethod,
      nome_cliente: customerName,
    };
    try {
      const res = await fetch('/api/vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.message || 'Ocorreu um erro desconhecido.');
      setIsPaymentModalOpen(false);
      setIsSuccessModalOpen(true);
      setCart([]);
      setCustomerName('');
    } catch (error) {
      setErrorMessage(error.message);
      setIsPaymentModalOpen(false);
    }
  };
  
  const toggleVariations = (parentName) => {
      setOpenVariations(prev => ({...prev, [parentName]: !prev[parentName]}));
  };

  const categoryOrder = ['Lanches', 'Supremo Grill', 'Bebidas Especiais', 'Bebidas'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3A3226] to-[#251a08] font-sans p-4 sm:p-6 pb-28">
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-8">
            <img src="/Logo.png" alt="Tio Flávio Lanches Logo" width="150" height="75" className="mx-auto mb-2" />
        </header>
        {loading ? <p className="text-center text-gray-300">A carregar cardápio...</p> : (
          <div className="space-y-8">
            {categoryOrder.map(category => (
              processedMenu[category] && (
                <div key={category}>
                  <h2 className="text-2xl font-semibold text-white border-b-2 border-[#A16207] pb-2 mb-4">{category}</h2>
                  <div className="space-y-4">
                    {processedMenu[category].map(product => {
                       if(product.isParent){
                            const isOpen = openVariations[product.nome];
                            return (
                                <div key={product.nome} className="bg-white/5 rounded-lg transition-all duration-300">
                                    <div onClick={() => toggleVariations(product.nome)} className="flex justify-between items-center p-3 cursor-pointer">
                                        <div>
                                            <p className="text-lg text-white">{product.nome}</p>
                                            {product.descricao && <p className="text-sm text-gray-300 mt-1 max-w-md">{product.descricao}</p>}
                                            <p className="text-md font-semibold text-yellow-200 mt-1">
                                                A partir de {Number(product.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </p>
                                        </div>
                                        <div className={`text-white transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                                            <ChevronDown size={24} />
                                        </div>
                                    </div>
                                    {isOpen && (
                                        <div className="px-3 pb-3">
                                            <div className="mt-2 pt-3 border-t border-white/10 space-y-2">
                                                {product.variations.map(variation => {
                                                    const cartItem = cart.find(item => item.id === variation.id);
                                                    const quantity = cartItem ? cartItem.quantity : 0;
                                                    const isOutOfStock = variation.quantidade_estoque <= 0;
                                                    return (
                                                        <div key={variation.id} className={`flex justify-between items-center pl-4 ${isOutOfStock ? 'opacity-50' : ''}`}>
                                                            <div>
                                                              <p className="text-white">{variation.variationName}</p>
                                                              <p className="text-sm text-yellow-300">{Number(variation.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                                            </div>
                                                            {isOutOfStock ? (
                                                                <span className="font-bold text-red-400 text-sm">ESGOTADO</span>
                                                            ) : quantity === 0 ? (
                                                                <button onClick={() => updateCart(variation, 1)} className="bg-transparent border border-yellow-200 text-yellow-200 rounded-full w-7 h-7 flex items-center justify-center transition-transform hover:scale-110">
                                                                    <Plus size={18} />
                                                                </button>
                                                            ) : (
                                                                <div className="flex items-center gap-2 bg-white/10 rounded-full p-1">
                                                                    <button onClick={() => updateCart(variation, quantity - 1)} className="text-white rounded-full w-6 h-6 flex items-center justify-center"> <Minus size={16} /> </button>
                                                                    <span className="text-md font-bold text-white w-5 text-center">{quantity}</span>
                                                                    <button onClick={() => updateCart(variation, quantity + 1)} className="bg-[#A16207] text-white rounded-full w-6 h-6 flex items-center justify-center"> <Plus size={16} /> </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        }
                      
                      const cartItem = cart.find(item => item.id === product.id);
                      const quantity = cartItem ? cartItem.quantity : 0;
                      const isOutOfStock = product.quantidade_estoque <= 0;
                      return (
                        <div key={product.id} className={`flex justify-between items-center bg-white/5 p-3 rounded-lg ${isOutOfStock ? 'opacity-50' : ''}`}>
                            <div>
                                <p className="text-lg text-white">{product.nome}</p>
                                {product.descricao && <p className="text-sm text-gray-300 mt-1">{product.descricao}</p>}
                                <p className="text-md font-semibold text-yellow-200 mt-1">
                                    {Number(product.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                            </div>
                            {isOutOfStock ? (
                                <span className="font-bold text-red-400 text-sm">ESGOTADO</span>
                            ) : quantity === 0 ? (
                                <button onClick={() => updateCart(product, 1)} className="bg-[#A16207] text-white rounded-full w-8 h-8 flex items-center justify-center transition-transform hover:scale-110">
                                    <Plus size={20} />
                                </button>
                            ) : (
                                <div className="flex items-center gap-2 bg-white/10 rounded-full p-1">
                                    <button onClick={() => updateCart(product, quantity - 1)} className="text-white rounded-full w-7 h-7 flex items-center justify-center"><Minus size={18} /></button>
                                    <span className="text-lg font-bold text-white w-6 text-center">{quantity}</span>
                                    <button onClick={() => updateCart(product, quantity + 1)} className="bg-[#A16207] text-white rounded-full w-7 h-7 flex items-center justify-center"><Plus size={18} /></button>
                                </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>
      
      {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-4 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.1)]">
              <div className="max-w-2xl mx-auto flex justify-between items-center">
                  <div>
                      <p className="font-bold text-lg text-[#422006]">Meu Pedido</p>
                      <p className="text-sm text-[#654321]">{totalItems} {totalItems > 1 ? 'itens' : 'item'}</p>
                  </div>
                  <button onClick={() => setIsPaymentModalOpen(true)} className="bg-[#A16207] text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 transition-transform hover:scale-105">
                      <span>Finalizar</span>
                      <span>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </button>
              </div>
          </div>
      )}

      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm m-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Finalizar Pedido</h2>
            <div className="my-4">
                <label className="block text-gray-800 mb-2 font-semibold">Seu Nome (para identificação)</label>
                <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full p-2 border border-gray-300 rounded" required />
            </div>
            <h3 className="text-lg font-semibold mb-3">Forma de Pagamento:</h3>
            <div className="flex flex-col gap-3 mb-6">
              {['Dinheiro'].map(method => (
                <button
                    key={method}
                    onClick={() => { setSelectedPaymentMethod(method); setCardType(null); }}
                    className={`w-full py-3 rounded-lg font-semibold text-lg border-2 ${selectedPaymentMethod === method ? 'bg-[#A16207] text-white border-[#A16207]' : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'}`}
                >
                    {method}
                </button>
              ))}
               <button
                    onClick={() => setSelectedPaymentMethod('Pix')}
                    className={`w-full py-3 rounded-lg font-semibold text-lg border-2 ${selectedPaymentMethod === 'Pix' ? 'bg-[#A16207] text-white border-[#A16207]' : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'}`}
                >
                    Pix
                </button>
              <button
                onClick={() => setSelectedPaymentMethod('Cartão')}
                className={`w-full py-3 rounded-lg font-semibold text-lg border-2 ${selectedPaymentMethod === 'Cartão' ? 'bg-[#A16207] text-white border-[#A16207]' : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'}`}
              >
                Cartão
              </button>
              {selectedPaymentMethod === 'Cartão' && (
                <div className="flex gap-3 animate-fade-in">
                    <button onClick={() => setCardType('Débito')} className={`w-full py-2 rounded-lg font-semibold border-2 ${cardType === 'Débito' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>Débito</button>
                    <button onClick={() => setCardType('Crédito')} className={`w-full py-2 rounded-lg font-semibold border-2 ${cardType === 'Crédito' ? 'bg-purple-600 text-white border-purple-600' : 'bg-purple-100 text-purple-800 border-purple-200'}`}>Crédito</button>
                </div>
              )}
            </div>
            {selectedPaymentMethod === 'Pix' && (
                <div className="text-center border-t pt-4">
                    <p className="font-semibold mb-2">Pague com PIX ({total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</p>
                    <canvas ref={qrCanvasRef} className="mx-auto border w-[220px] h-[220px]"></canvas>
                    <p className="text-sm mt-2 text-gray-600">Ou use a chave "Copia e Cola":</p>
                    <div className="mt-1 flex items-center justify-between p-2 bg-gray-100 rounded-lg w-full">
                        <span className="text-gray-800 font-mono text-xs mr-2 overflow-hidden whitespace-nowrap text-ellipsis max-w-[calc(100%-40px)]">{pixPayload}</span>
                        <button onClick={copyToClipboard} className="bg-gray-200 p-1 rounded-md hover:bg-gray-300">
                            {copySuccess ? copySuccess : <Copy size={16} />}
                        </button>
                    </div>
                </div>
            )}
            <div className="flex justify-end gap-3 mt-6 border-t pt-4">
              <button onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg">Voltar</button>
              <button onClick={handleConfirmPayment} className="px-4 py-2 bg-[#A16207] text-white rounded-lg">Enviar Pedido</button>
            </div>
          </div>
        </div>
      )}

      {isSuccessModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-10 rounded-lg shadow-xl w-full max-w-sm text-center">
            <CheckCircle size={50} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Pedido enviado com sucesso!</h2>
            <p className="text-gray-700 mb-6">Por favor, dirija-se ao balcão ou chame o atendente para confirmar o pagamento.</p>
            <button onClick={() => setIsSuccessModalOpen(false)} className="mt-4 px-6 py-2 bg-[#A16207] text-white rounded-lg font-semibold">Fechar</button>
          </div>
        </div>
      )}
      {errorMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-10 rounded-lg shadow-xl w-full max-w-sm text-center">
            <Ban size={50} className="text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Atenção</h2>
            <p className="text-gray-700 mb-6">{errorMessage}</p>
            <button onClick={() => setErrorMessage('')} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
