'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { PlusCircle, Edit, Trash2, ArrowLeft, XCircle, Search, ChevronDown } from 'lucide-react';

export default function EstoquePage() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({ nome: '', preco: '', preco_custo: '', quantidade_estoque: '', categoria: 'Lanches' });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [openVariations, setOpenVariations] = useState({});

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/produtos');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      } else {
        console.error("Erro ao buscar produtos da API.");
      }
    } catch (error) {
      console.error("Erro de rede ao buscar produtos:", error);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const processedProducts = useMemo(() => {
    const parents = {};
    const standalone = [];

    const sourceProducts = searchTerm
      ? products.filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase()))
      : products;

    sourceProducts.forEach(product => {
      if (product.nome.includes(':')) {
        const [parentName, variationName] = product.nome.split(':').map(s => s.trim());
        if (!parents[parentName]) {
          parents[parentName] = {
            isParent: true,
            nome: parentName,
            categoria: product.categoria,
            variations: []
          };
        }
        parents[parentName].variations.push({ ...product, variationName });
      } else {
        standalone.push(product);
      }
    });

    const groupedList = Object.values(parents);
    // Ordena os itens principais e variações em ordem alfabética
    groupedList.forEach(p => p.variations.sort((a,b) => a.variationName.localeCompare(b.variationName)));
    
    const combinedList = [...groupedList, ...standalone];
    combinedList.sort((a,b) => a.nome.localeCompare(b.nome));

    return combinedList;
  }, [products, searchTerm]);

  const toggleVariations = (parentName) => {
    setOpenVariations(prev => ({ ...prev, [parentName]: !prev[parentName] }));
  };

  const openModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setNewProduct({ 
        nome: product.nome, 
        preco: product.preco,
        preco_custo: product.preco_custo || '',
        quantidade_estoque: product.quantidade_estoque,
        categoria: product.categoria || 'Lanches' 
      });
    } else {
      setEditingProduct(null);
      setNewProduct({ nome: '', preco: '', preco_custo: '', quantidade_estoque: '', categoria: 'Lanches' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const method = editingProduct ? 'PUT' : 'POST';
    const url = editingProduct ? `/api/produtos?id=${editingProduct.id}` : '/api/produtos';
    
    const productData = {
      ...newProduct,
      preco: parseFloat(newProduct.preco),
      preco_custo: parseFloat(newProduct.preco_custo),
      quantidade_estoque: parseInt(newProduct.quantidade_estoque, 10),
    };

    try {
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });

      if (res.ok) {
        fetchProducts();
        closeModal();
      }
    } catch (error) {
      console.error(`Erro de rede ao ${editingProduct ? 'editar' : 'adicionar'} produto:`, error);
    }
  };
  
  const openDeleteModal = (product) => {
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setProductToDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;

    try {
      const res = await fetch(`/api/produtos?id=${productToDelete.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchProducts();
        closeDeleteModal();
      } else {
         const errorData = await res.json();
         alert(`Erro ao excluir: ${errorData.error}`);
         closeDeleteModal();
      }
    } catch (error) {
      console.error("Erro de rede ao excluir produto:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3A3226] to-[#251a08] p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
           <h1 className="text-3xl font-bold text-white">Controle de Estoque</h1>
           <Link href="/">
                <button className="flex items-center gap-2 px-4 py-2 bg-[#A16207] text-white rounded-lg font-semibold hover:bg-[#8f5606] transition-colors">
                    <ArrowLeft size={18} />
                    Voltar ao Início
                </button>
            </Link>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl shadow-lg p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="relative flex-grow w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Pesquisar por nome do produto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-3 pl-10 border rounded-lg bg-white/10 text-white placeholder-gray-300 border-white/20 focus:outline-none focus:ring-2 focus:ring-[#A16207]"
                    />
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex w-full sm:w-auto items-center justify-center gap-2 bg-[#A16207] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#8f5606] transition-colors flex-shrink-0"
                >
                    <PlusCircle size={20} />
                    Adicionar Produto
                </button>
            </div>
            
            <div className="space-y-2">
              {processedProducts.map((product) => (
                  <div key={product.nome} className="bg-white/5 rounded-lg">
                      {product.isParent ? (
                          // Item PAI com variações
                          <>
                              <div onClick={() => toggleVariations(product.nome)} className="flex items-center p-4 cursor-pointer">
                                  <div className="flex-1 font-medium text-white">{product.nome} ({product.variations.length} variações)</div>
                                  <ChevronDown className={`text-gray-300 transition-transform ${openVariations[product.nome] ? 'rotate-180' : ''}`} size={20} />
                              </div>
                              {openVariations[product.nome] && (
                                  <div className="px-4 pb-2">
                                      {product.variations.map(variation => (
                                          <div key={variation.id} className="flex items-center py-2 border-t border-white/10 ml-4">
                                              <div className="w-2/5 text-gray-300">{variation.variationName}</div>
                                              <div className="w-1/5 text-gray-300">R$ {Number(variation.preco_custo).toFixed(2)}</div>
                                              <div className="w-1/5 text-gray-300">R$ {Number(variation.preco).toFixed(2)}</div>
                                              <div className="w-1/5 text-gray-300">{variation.quantidade_estoque}</div>
                                              <div className="flex gap-4">
                                                  <button onClick={() => openModal(variation)} className="text-yellow-300 hover:text-yellow-100" title="Editar"><Edit size={18} /></button>
                                                  <button onClick={() => openDeleteModal(variation)} className="text-red-400 hover:text-red-300" title="Excluir"><Trash2 size={18} /></button>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </>
                      ) : (
                          // Item individual
                          <div className="flex items-center p-4 text-gray-200">
                              <div className="w-2/5 font-medium">{product.nome}</div>
                              <div className="w-1/5">R$ {product.preco_custo ? Number(product.preco_custo).toFixed(2) : 'N/A'}</div>
                              <div className="w-1/5">R$ {Number(product.preco).toFixed(2)}</div>
                              <div className="w-1/5">{product.quantidade_estoque}</div>
                              <div className="flex gap-4">
                                  <button onClick={() => openModal(product)} className="text-yellow-300 hover:text-yellow-100" title="Editar"><Edit size={18} /></button>
                                  <button onClick={() => openDeleteModal(product)} className="text-red-400 hover:text-red-300" title="Excluir"><Trash2 size={18} /></button>
                              </div>
                          </div>
                      )}
                  </div>
              ))}
            </div>

            {processedProducts.length === 0 && (
                <div className="text-center py-10 text-gray-400">
                    <p>Nenhum produto encontrado.</p>
                </div>
            )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-6">{editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}</h2>
            <form onSubmit={handleFormSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Nome do Produto (use "Principal: Variação")</label>
                <input type="text" value={newProduct.nome} onChange={(e) => setNewProduct({ ...newProduct, nome: e.target.value })} className="w-full p-2 border rounded" required />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Categoria</label>
                <select value={newProduct.categoria} onChange={(e) => setNewProduct({ ...newProduct, categoria: e.target.value })} className="w-full p-2 border rounded" required >
                    <option value="Lanches">Lanches</option>
                    <option value="Supremo Grill">Supremo Grill</option>
                    <option value="Bebidas Especiais">Bebidas Especiais</option>
                    <option value="Bebidas">Bebidas</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-gray-700 mb-2">Custo (R$)</label>
                  <input type="number" step="0.01" value={newProduct.preco_custo} onChange={(e) => setNewProduct({ ...newProduct, preco_custo: e.target.value })} className="w-full p-2 border rounded" required />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Venda (R$)</label>
                  <input type="number" step="0.01" value={newProduct.preco} onChange={(e) => setNewProduct({ ...newProduct, preco: e.target.value })} className="w-full p-2 border rounded" required />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Estoque</label>
                  <input type="number" value={newProduct.quantidade_estoque} onChange={(e) => setNewProduct({ ...newProduct, quantidade_estoque: e.target.value })} className="w-full p-2 border rounded" required />
                </div>
              </div>
              <div className="flex justify-end gap-4">
                <button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-200 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-[#A16207] text-white rounded-lg">{editingProduct ? 'Salvar Alterações' : 'Adicionar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-10 rounded-lg shadow-xl w-full max-w-sm text-center">
            <XCircle size={50} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Confirmar Exclusão</h2>
            <p className="text-gray-600 mb-6">
              Tem certeza que quer excluir "{productToDelete?.nome}"? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-center gap-4">
              <button onClick={closeDeleteModal} className="px-6 py-2 bg-gray-200 rounded-lg font-semibold">Cancelar</button>
              <button onClick={handleDeleteConfirm} className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

