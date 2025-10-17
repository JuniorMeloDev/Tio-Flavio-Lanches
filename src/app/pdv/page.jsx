'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ShoppingCart, ArrowLeft, XCircle, CheckCircle, X, Printer, Ban, Plus, Copy } from 'lucide-react';

// Função para gerar e imprimir o comprovativo
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
                    <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                        <span style="width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.produtos.nome} (${item.quantidade}x)</span>
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
    // Adicionado style no body para remover margens padrão
    printWindow.document.write(`<html><head><title>Comprovante</title></head><body style="margin:0; padding:0;">${receiptContent}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    // Adiciona um pequeno delay para garantir a renderização antes de imprimir
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250); // 250ms de delay
};

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
    const cleanKey = String(key || '').trim().replace(/[^a-zA-Z0-9@.-]/g, '');
    const cleanName = String(merchantName || '').trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 25);
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

export default function PdvPage() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isCartOpenMobile, setIsCartOpenMobile] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('Dinheiro');
  const [cardType, setCardType] = useState(null);
  const [activeCategory, setActiveCategory] = useState('Lanches');
  const [searchTerm, setSearchTerm] = useState('');
  const [variationModalProduct, setVariationModalProduct] = useState(null);
  const [pixPayload, setPixPayload] = useState('');
  const [copySuccess, setCopySuccess] = useState('');
  const qrCanvasRef = useRef(null);
  const categories = ['Lanches', 'Supremo Grill', 'Bebidas Especiais', 'Bebidas'];
  const [lastSaleId, setLastSaleId] = useState(null);
  
  const PIX_KEY = process.env.NEXT_PUBLIC_PIX_KEY;
  const PIX_MERCHANT_NAME = process.env.NEXT_PUBLIC_PIX_MERCHANT_NAME;
  const PIX_MERCHANT_CITY = process.env.NEXT_PUBLIC_PIX_MERCHANT_CITY;

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

  useEffect(() => {
    if (isPaymentModalOpen && selectedPaymentMethod === 'Pix' && qrCanvasRef.current && window.QRious) {
        const payload = generatePixPayload(PIX_KEY, PIX_MERCHANT_NAME, PIX_MERCHANT_CITY, total);
        setPixPayload(payload);
        
        new window.QRious({
            element: qrCanvasRef.current,
            value: payload,
            size: 220,
            padding: 10,
        });
    }
  }, [isPaymentModalOpen, selectedPaymentMethod, total, PIX_KEY, PIX_MERCHANT_NAME, PIX_MERCHANT_CITY]);

  const copyToClipboard = () => {
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
      if (!res.ok) throw new Error('Falha ao carregar produtos da API.');
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      setErrorMessage(error.message);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

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
          parents[parentName] = { isParent: true, nome: parentName, variations: [], preco: product.preco };
        }
        parents[parentName].variations.push({ ...product, variationName });
      } else {
        standalone.push(product);
      }
    });
    
    Object.values(parents).forEach(parent => {
        parent.variations.sort((a,b) => a.variationName.localeCompare(b.variationName));
    });

    const combined = [...Object.values(parents), ...standalone];
    combined.sort((a,b) => a.nome.localeCompare(b.nome));
    return combined;

  }, [products, activeCategory, searchTerm]);

  useEffect(() => {
    const newTotal = cart.reduce((acc, item) => acc + item.preco * item.quantity, 0);
    setTotal(newTotal);
  }, [cart]);

  const handleFilterCategory = (category) => {
    setActiveCategory(category);
    setSearchTerm('');
  };
  
  const handleProductClick = (product) => {
      if (product.isParent) {
          setVariationModalProduct(product);
      } else {
          addToCart(product);
      }
  };

  const addToCart = (product) => {
    if (product.quantidade_estoque <= 0) {
        setErrorMessage(`Produto "${product.nome}" esgotado.`);
        return;
    }

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      
      if (existingItem && existingItem.quantity >= product.quantidade_estoque) {
          setErrorMessage(`Limite de estoque para "${product.nome}" atingido.`);
          return prevCart;
      }
      
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  };

  const handleConfirmPayment = async () => {
    if (cart.length === 0) {
      setErrorMessage('O carrinho está vazio.');
      return;
    }
    let finalPaymentMethod = selectedPaymentMethod;
    if (selectedPaymentMethod === 'Cartão') {
        if (!cardType) {
            setErrorMessage('Por favor, selecione Débito ou Crédito.');
            return;
        }
        finalPaymentMethod = `Cartão - ${cardType}`;
    }
    const saleData = {
      itens: cart.map(item => ({ id: item.id, quantity: item.quantity, preco: item.preco, preco_custo: item.preco_custo, nome: item.nome })),
      total: total,
      metodo_pagamento: finalPaymentMethod,
      nome_cliente: 'PDV'
    };
    try {
      const res = await fetch('/api/vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
      });
      const responseData = await res.json();
      if (!res.ok) {
        throw new Error(responseData.message || 'Ocorreu um erro desconhecido.');
      }
      setLastSaleId(responseData.venda_id);
      setIsPaymentModalOpen(false);
      setIsCartOpenMobile(false);
      setIsSuccessModalOpen(true);
      setCart([]);
      fetchProducts();
    } catch (error) {
        setErrorMessage(error.message);
        setIsPaymentModalOpen(false);
    }
  };
  
  const handlePrint = async (saleId) => {
    if (!saleId) return;
    try {
      const res = await fetch(`/api/vendas/${saleId}`);
      if (!res.ok) throw new Error('Não foi possível buscar os dados da venda para impressão.');
      const vendaData = await res.json();
      generateAndPrintReceipt(vendaData);
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message);
    }
  };

  const closeSuccessModal = () => {
    setIsSuccessModalOpen(false);
    setLastSaleId(null);
  };
  
  const CartComponent = ({isMobile}) => (
    <div className={`p-6 flex flex-col h-full bg-white w-full`}>
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
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <p className="text-gray-500">O carrinho está vazio.</p>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex justify-between items-center mb-3">
                <div>
                  <p className="font-semibold">{item.nome}</p>
                  <p className="text-sm text-gray-500">
                    {item.quantity} x R$ {Number(item.preco).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                    <p className="font-bold">R$ {(item.preco * item.quantity).toFixed(2)}</p>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700">
                        <X size={18}/>
                    </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t pt-4">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xl font-bold">Total</span>
            <span className="text-2xl font-bold text-[#A16207]">R$ {total.toFixed(2)}</span>
          </div>
          <button
            onClick={() => {
              if (cart.length > 0) {
                setIsPaymentModalOpen(true);
              } else {
                setErrorMessage('Adicione itens ao carrinho para finalizar a venda.');
              }
            }}
            className="w-full bg-[#A16207] text-white py-3 rounded-lg font-bold text-lg hover:bg-[#8f5606] transition-colors disabled:bg-gray-400"
            disabled={cart.length === 0}
          >
            Finalizar Venda
          </button>
        </div>
    </div>
  );

  return (
    <div className="relative flex flex-col md:flex-row h-screen bg-gradient-to-br from-[#3A3226] to-[#251a08] font-sans overflow-hidden">
      <div className="p-6 flex flex-col flex-1 min-h-0">
        <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white">Ponto de Venda</h1>
            <a href="/" className="flex items-center gap-2 px-4 py-2 bg-[#A16207] text-white rounded-lg font-semibold hover:bg-[#8f5606] transition-colors">
                <ArrowLeft size={18} />
                Voltar ao Início
            </a>
        </div>
        <div className="mb-4">
            <input 
                type="text" 
                placeholder="Buscar produto por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border rounded-lg bg-white/10 text-white placeholder-gray-300 border-white/20 focus:outline-none focus:ring-2 focus:ring-[#A16207]"
            />
        </div>
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {categories.map(category => (
                <button 
                    key={category}
                    onClick={() => handleFilterCategory(category)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap ${activeCategory === category && !searchTerm ? 'bg-[#A16207] text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}
                >
                    {category}
                </button>
            ))}
        </div>
        <div className="flex-1 overflow-y-auto pr-2 min-h-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {processedProducts.map((product) => {
              const isOutOfStock = product.isParent ? product.variations.every(v => v.quantidade_estoque <= 0) : product.quantidade_estoque <= 0;
              return (
                <button
                  key={product.nome}
                  title={isOutOfStock ? `${product.nome} (Esgotado)` : product.nome}
                  onClick={() => handleProductClick(product)}
                  disabled={isOutOfStock}
                  className={`relative bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow hover:shadow-lg transition-all text-left flex flex-col justify-between h-28 ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                >
                  {isOutOfStock && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                        <span className="text-white font-bold text-lg">ESGOTADO</span>
                    </div>
                  )}
                  <span className="font-semibold text-[#422006] break-words line-clamp-2">{product.nome}</span>
                  <span className="text-[#654321]">
                    {product.isParent ? `A partir de R$ ${Number(product.preco).toFixed(2)}` : `R$ ${Number(product.preco).toFixed(2)}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="hidden md:flex md:w-[450px] md:flex-shrink-0 shadow-lg">
        <CartComponent isMobile={false} />
      </div>

      {cart.length > 0 && (
        <div className="md:hidden fixed bottom-4 right-4 z-40">
            <button onClick={() => setIsCartOpenMobile(true)} className="bg-[#A16207] text-white rounded-full p-4 shadow-lg flex items-center justify-center gap-3">
                <ShoppingCart size={24} />
                <span className="font-bold">Ver Carrinho ({cart.reduce((acc, item) => acc + item.quantity, 0)})</span>
                <span className="font-bold">R$ {total.toFixed(2)}</span>
            </button>
        </div>
      )}

      {isCartOpenMobile && (
          <div className="md:hidden fixed inset-0 z-50">
              <CartComponent isMobile={true} />
          </div>
      )}

      {variationModalProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">{variationModalProduct.nome}</h2>
              <button onClick={() => setVariationModalProduct(null)} className="text-gray-500 hover:text-gray-800">
                <X size={24} />
              </button>
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
                    {isOutOfStock ? (
                      <span className="font-bold text-red-500 text-sm">ESGOTADO</span>
                    ) : (
                      <button 
                        onClick={() => addToCart(variation)}
                        className="bg-[#A16207] text-white rounded-full w-9 h-9 flex items-center justify-center transition-transform hover:scale-110"
                      >
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

      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm m-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-center">Total a Pagar</h2>
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
                    <button onClick={() => setCardType('Débito')} className={`w-full py-2 rounded-lg font-semibold border-2 ${cardType === 'Débito' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>Débito</button>
                    <button onClick={() => setCardType('Crédito')} className={`w-full py-2 rounded-lg font-semibold border-2 ${cardType === 'Crédito' ? 'bg-purple-600 text-white border-purple-600' : 'bg-purple-100 text-purple-800 border-purple-200'}`}>Crédito</button>
                </div>
              )}
            </div>
            {selectedPaymentMethod === 'Pix' && (
                <div className="text-center border-t pt-4">
                    <p className="font-semibold mb-2">Pague com PIX ({total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</p>
                    <canvas ref={qrCanvasRef} className="mx-auto border"></canvas>
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
              <button onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg">Cancelar</button>
              <button onClick={handleConfirmPayment} className="px-4 py-2 bg-[#A16207] text-white rounded-lg font-bold">Confirmar Pagamento</button>
            </div>
          </div>
        </div>
      )}
      
      {isSuccessModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white p-10 rounded-lg shadow-xl w-full max-w-sm m-4 text-center">
            <CheckCircle size={50} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Venda finalizada com sucesso!</h2>
            <div className="flex flex-col gap-3 mt-6">
                <button 
                  onClick={() => handlePrint(lastSaleId)}
                  className="w-full bg-[#A16207] text-white py-3 rounded-lg font-semibold hover:bg-[#8f5606] flex items-center justify-center gap-2"
                >
                    <Printer size={18} />
                    Imprimir Comprovante
                </button>
                <button onClick={closeSuccessModal} className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg font-semibold hover:bg-gray-300">
                    Nova Venda
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

