'use client';

import { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Plus, Minus, CheckCircle, XCircle, Ban, ChevronDown, ChevronUp } from 'lucide-react';

export default function CardapioPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [openVariations, setOpenVariations] = useState({});

  useEffect(() => {
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
    fetchProducts();
  }, []);

  const processedMenu = useMemo(() => {
    const menu = {};
    const standalone = {};

    products.forEach(product => {
      if (product.nome.includes(':')) {
        const [parentName, variationName] = product.nome.split(':').map(s => s.trim());
        if (!menu[parentName]) {
          menu[parentName] = {
            preco: product.preco,
            categoria: product.categoria,
            variations: []
          };
        }
        menu[parentName].variations.push({ ...product, variationName });
      } else {
        if (!standalone[product.categoria]) {
            standalone[product.categoria] = [];
        }
        standalone[product.categoria].push(product);
      }
    });
    
    const finalMenu = {};
    
    for(const parentName in menu){
        const item = menu[parentName];
        if(!finalMenu[item.categoria]){
            finalMenu[item.categoria] = [];
        }
        // Ordena as variações em ordem alfabética
        item.variations.sort((a, b) => a.variationName.localeCompare(b.variationName));
        finalMenu[item.categoria].push({
            isParent: true,
            nome: parentName,
            ...item
        });
    }

    for(const category in standalone){
         if(!finalMenu[category]){
            finalMenu[category] = [];
        }
        finalMenu[category].push(...standalone[category]);
    }

    // Ordena os itens principais de cada categoria em ordem alfabética
    for (const category in finalMenu) {
        finalMenu[category].sort((a, b) => a.nome.localeCompare(b.nome));
    }

    return finalMenu;
  }, [products]);

  const total = useMemo(() => cart.reduce((acc, item) => acc + item.preco * item.quantity, 0), [cart]);
  const totalItems = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);

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
      setIsPaymentModalOpen(false);
      setErrorMessage("Por favor, insira o seu nome para identificação.");
      return;
    }

    const saleData = {
      itens: cart.map(item => ({ id: item.id, quantity: item.quantity, preco: item.preco, preco_custo: item.preco_custo, nome: item.nome })),
      total: total,
      metodo_pagamento: "Balcão (Cliente)",
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

        {loading ? <p className="text-center text-gray-300">Carregando cardápio...</p> : (
          <div className="space-y-8">
            {categoryOrder.map(category => (
              processedMenu[category] && (
                <div key={category}>
                  <h2 className="text-2xl font-semibold text-white border-b-2 border-[#A16207] pb-2 mb-4">
                    {category}
                  </h2>
                  <div className="space-y-4">
                    {processedMenu[category].map(product => {
                        if(product.isParent){
                            const isOpen = openVariations[product.nome];
                            return (
                                <div key={product.nome} className="bg-white/5 rounded-lg transition-all duration-300">
                                    <div onClick={() => toggleVariations(product.nome)} className="flex justify-between items-center p-3 cursor-pointer">
                                        <div>
                                            <p className="text-lg text-white">{product.nome}</p>
                                            <p className="text-md font-semibold text-yellow-200">
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
                                                            <p className="text-white">{variation.variationName}</p>
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
                                <p className="text-md font-semibold text-yellow-200">
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
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md text-gray-800">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Confirmar Pedido</h2>
            <div className="max-h-60 overflow-y-auto space-y-2 mb-4 text-gray-700">
                {cart.map(item => (
                    <div key={item.id} className="flex justify-between">
                        <p>{item.quantity}x {item.nome}</p>
                        <p className="font-semibold">R$ {(item.quantity * item.preco).toFixed(2)}</p>
                    </div>
                ))}
            </div>
            <div className="border-t pt-4 flex justify-between font-bold text-xl text-gray-900">
                <p>Total</p>
                <p>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
            <div className="my-4">
                <label className="block text-gray-800 mb-2 font-semibold">Seu Nome (para identificação)</label>
                <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full p-2 border border-gray-300 rounded" required />
            </div>
            <p className="text-center text-gray-600 my-4">O pagamento será realizado no balcão.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg">Voltar</button>
              <button onClick={handleConfirmPayment} className="px-4 py-2 bg-[#A16207] text-white rounded-lg">Confirmar Pedido</button>
            </div>
          </div>
        </div>
      )}

      {isSuccessModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-10 rounded-lg shadow-xl w-full max-w-sm text-center">
            <CheckCircle size={50} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Pedido enviado com sucesso!</h2>
            <p className="text-gray-700 mb-6">Por favor, dirija-se ao balcão para o pagamento.</p>
            <button onClick={() => setIsSuccessModalOpen(false)} className="mt-4 px-6 py-2 bg-[#A16207] text-white rounded-lg font-semibold">
              Fechar
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-10 rounded-lg shadow-xl w-full max-w-sm text-center">
            <Ban size={50} className="text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Atenção</h2>
            <p className="text-gray-700 mb-6">{errorMessage}</p>
            <button onClick={() => setErrorMessage('')} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

