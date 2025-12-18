'use client';

// importamos useRef e os novos ícones
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  PlusCircle, Edit, Trash2, ArrowLeft, XCircle, Search, ChevronDown, ChevronRight, CheckCircle,
  Download, Upload, Layers // Ícones de Download, Upload e Layers (para categorias)
} from 'lucide-react';

// Importar a biblioteca xlsx
import * as XLSX from 'xlsx';

export default function EstoquePage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false); // Novo modal de categorias
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [editingProduct, setEditingProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({ nome: '', preco: '', preco_custo: '', quantidade_estoque: '', categoria: 'Lanches', descricao: '' });

  // Estados para gerenciamento de categorias
  const [categoryName, setCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);

  const [productToDelete, setProductToDelete] = useState(null);
  const [openVariations, setOpenVariations] = useState({});
  const [openCategories, setOpenCategories] = useState({}); // Estado para acordeão de categorias
  const [notification, setNotification] = useState({ show: false, message: '' });

  // Estado de loading para a importação
  const [isLoading, setIsLoading] = useState(false);

  // Referência para o input de arquivo escondido
  const fileInputRef = useRef(null);

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

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categorias');
      if (res.ok) {
        const data = await res.json();
        setCategories(data || []);
      }
    } catch (error) {
      console.error("Erro ao buscar categorias.", error);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
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
          parents[parentName] = { isParent: true, nome: parentName, categoria: product.categoria, variations: [] };
        }
        parents[parentName].variations.push({ ...product, variationName });
      } else {
        standalone.push(product);
      }
    });

    const groupedList = Object.values(parents);
    groupedList.forEach(p => p.variations.sort((a, b) => a.variationName.localeCompare(b.variationName)));
    const combinedList = [...groupedList, ...standalone];
    combinedList.sort((a, b) => a.nome.localeCompare(b.nome));
    return combinedList;
  }, [products, searchTerm]);

  // Agrupar produtos por categoria para exibição
  const groupedProducts = useMemo(() => {
    const groups = {};
    processedProducts.forEach(product => {
      const cat = product.categoria || 'Sem Categoria';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(product);
    });
    return groups;
  }, [processedProducts]);

  // Auto-expandir categorias se houver busca
  useEffect(() => {
    if (searchTerm) {
      setOpenCategories(prev => {
        const next = { ...prev };
        Object.keys(groupedProducts).forEach(cat => next[cat] = true);
        return next;
      });
    }
  }, [searchTerm, groupedProducts]);

  const toggleCategory = (catName) => {
    setOpenCategories(prev => ({ ...prev, [catName]: !prev[catName] }));
  };

  const toggleVariations = (parentName) => {
    setOpenVariations(prev => ({ ...prev, [parentName]: !prev[parentName] }));
  };

  const openModal = (product = null) => {
    // Definir categoria padrão: primeira da lista ou 'Lanches' se vazio
    const defaultCategory = categories.length > 0 ? categories[0].nome : 'Lanches';

    if (product) {
      setEditingProduct(product);
      setNewProduct({
        nome: product.nome,
        preco: product.preco,
        preco_custo: product.preco_custo || '',
        quantidade_estoque: product.quantidade_estoque,
        categoria: product.categoria || defaultCategory,
        descricao: product.descricao || ''
      });
    } else {
      setEditingProduct(null);
      setNewProduct({
        nome: '',
        preco: '',
        preco_custo: '',
        quantidade_estoque: '',
        categoria: defaultCategory,
        descricao: ''
      });
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

    const productData = { ...newProduct };

    try {
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });

      if (res.ok) {
        fetchProducts();
        closeModal();
        setNotification({ show: true, message: `Produto ${editingProduct ? 'atualizado' : 'adicionado'} com sucesso!` });
      }
    } catch (error) {
      console.error(`Erro de rede ao ${editingProduct ? 'editar' : 'adicionar'} produto:`, error);
    }
  };

  // --- LÓGICA DE CATEGORIAS ---

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    if (editingCategory) {
      // EDITAR
      try {
        const res = await fetch('/api/categorias', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingCategory.id, nome: categoryName }),
        });
        if (res.ok) {
          fetchCategories();
          setCategoryName('');
          setEditingCategory(null);
          setNotification({ show: true, message: 'Categoria atualizada!' });
        } else {
          alert('Erro ao atualizar categoria');
        }
      } catch (error) {
        console.error(error);
      }
    } else {
      // CRIAR NOVA
      try {
        const res = await fetch('/api/categorias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: categoryName }),
        });

        if (res.ok) {
          fetchCategories();
          setCategoryName('');
          setNotification({ show: true, message: 'Categoria criada com sucesso!' });
        } else {
          const err = await res.json();
          alert(`Erro ao criar categoria: ${err.error}`);
        }
      } catch (error) {
        console.error("Erro ao criar categoria:", error);
      }
    }
  };

  const startEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryName(cat.nome);
  };

  const cancelEditCategory = () => {
    setEditingCategory(null);
    setCategoryName('');
  };

  const deleteCategory = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;

    try {
      const res = await fetch(`/api/categorias?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCategories();
        // Se estava editando ela, cancela
        if (editingCategory?.id === id) cancelEditCategory();
        setNotification({ show: true, message: 'Categoria excluída!' });
      } else {
        alert('Erro ao excluir categoria.');
      }
    } catch (error) {
      console.error(error);
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
      const res = await fetch(`/api/produtos?id=${productToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchProducts();
        closeDeleteModal();
        setNotification({ show: true, message: 'Produto excluído com sucesso!' });
      } else {
        const errorData = await res.json();
        alert(`Erro ao excluir: ${errorData.error}`);
        closeDeleteModal();
      }
    } catch (error) {
      console.error("Erro de rede ao excluir produto:", error);
    }
  };

  // Função para exportar para Excel
  const handleExport = () => {
    // É crucial exportar o ID para que a importação saiba qual produto atualizar
    const dataToExport = products.map(p => ({
      id: p.id,
      nome: p.nome,
      preco_custo: p.preco_custo,
      preco: p.preco,
      quantidade_estoque: p.quantidade_estoque,
      categoria: p.categoria,
      descricao: p.descricao
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    XLSX.writeFile(wb, 'produtos_estoque.xlsx');
  };

  // Função para importar do Excel
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws);

        // Garantir que os dados da planilha estão no formato correto
        const productsToUpdate = jsonData.filter(p => p.id).map(p => ({
          id: p.id,
          nome: p.nome,
          preco: Number(p.preco) || 0,
          preco_custo: Number(p.preco_custo) || 0,
          quantidade_estoque: Number(p.quantidade_estoque) || 0
        }));

        const res = await fetch('/api/produtos/atualizacao-lote-estoque', { // Chamada para a NOVA rota
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productsToUpdate),
        });

        if (res.ok) {
          setNotification({ show: true, message: 'Produtos atualizados com sucesso!' });
          fetchProducts(); // Atualiza a lista
        } else {
          const error = await res.json();
          setNotification({ show: true, message: `Erro ao importar: ${error.message || 'Erro desconhecido'}` });
        }
      } catch (error) {
        console.error("Erro ao processar arquivo:", error);
        setNotification({ show: true, message: 'Erro ao ler o arquivo.' });
      } finally {
        setIsLoading(false);
        e.target.value = null; // Limpa o input de arquivo
      }
    };
    reader.readAsArrayBuffer(file);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3A3226] to-[#251a08] p-4 sm:p-8 font-sans">
      {/* Overlay de Loading */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
          <div className="text-white text-xl font-semibold animate-pulse">
            Atualizando produtos...
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Controle de Estoque</h1>
          <a href="/" className="flex items-center gap-2 px-4 py-2 bg-[#A16207] text-white rounded-lg font-semibold hover:bg-[#8f5606] transition-colors">
            <ArrowLeft size={18} />
            Voltar ao Início
          </a>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl shadow-lg p-6 sm:p-8">
          {/* Layout dos botões atualizado */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div className="relative flex-grow w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input type="text" placeholder="Pesquisar por nome do produto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-3 pl-10 border rounded-lg bg-white/10 text-white placeholder-gray-300 border-white/20 focus:outline-none focus:ring-2 focus:ring-[#A16207]" />
            </div>

            {/* Wrapper para os botões */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-shrink-0">
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="flex w-full sm:w-auto items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
              >
                <Layers size={20} />
                Nova Categoria
              </button>
              <button
                onClick={handleExport}
                disabled={isLoading}
                className="flex w-full sm:w-auto items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Download size={20} />
                Exportar
              </button>
              <button
                onClick={() => fileInputRef.current.click()}
                disabled={isLoading}
                className="flex w-full sm:w-auto items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Upload size={20} />
                Importar
              </button>
              <button
                onClick={() => openModal()}
                disabled={isLoading}
                className="flex w-full sm:w-auto items-center justify-center gap-2 bg-[#A16207] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#8f5606] transition-colors disabled:opacity-50"
              >
                <PlusCircle size={20} />
                Adicionar Produto
              </button>
              {/* Input de arquivo escondido */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                style={{ display: 'none' }}
                accept=".xlsx, .xls"
              />
            </div>
          </div>

          <div className="space-y-2">

            {/* Cabeçalho da tabela (Global) - visível em telas sm e maiores */}
            <div className="hidden sm:flex items-center p-4 text-gray-300 font-bold bg-white/10 rounded-lg">
              <div className="w-2/5">Produto</div>
              <div className="w-1/5">Custo</div>
              <div className="w-1/5">Venda</div>
              <div className="w-1/5">Estoque</div>
              <div className="justify-start" style={{ flexBasis: '60px', flexShrink: 0 }}>Ações</div>
            </div>

            {/* Renderização de Categorias (Accordion) */}
            {Object.keys(groupedProducts).length > 0 ? (
              Object.keys(groupedProducts).sort().map(category => (
                <div key={category} className="rounded-lg overflow-hidden border border-white/5 mb-2">
                  {/* Header da Categoria */}
                  <div
                    className="flex justify-between items-center p-4 cursor-pointer bg-white/10 hover:bg-white/20 transition-colors"
                    onClick={() => toggleCategory(category)}
                  >
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {openCategories[category] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      {category}
                      <span className="text-sm font-normal text-gray-400">({groupedProducts[category].length} itens)</span>
                    </h3>
                  </div>

                  {/* Lista de Produtos da Categoria */}
                  {openCategories[category] && (
                    <div className="bg-black/20 p-2 space-y-2 border-t border-white/5">
                      {groupedProducts[category].map((product) => (
                        <div key={product.nome} className="bg-white/5 rounded-lg">
                          {product.isParent ? (
                            <>
                              <div onClick={() => toggleVariations(product.nome)} className="flex items-center p-4 cursor-pointer">
                                <div className="flex-1 font-medium text-white">{product.nome} ({product.variations.length} variações)</div>
                                <ChevronDown className={`text-gray-300 transition-transform ${openVariations[product.nome] ? 'rotate-180' : ''}`} size={20} />
                              </div>
                              {openVariations[product.nome] && (
                                <div className="px-4 pb-2">
                                  {/* Cabeçalho Interno de Variações */}
                                  <div className="hidden sm:flex items-center py-2 border-t border-white/10 ml-4 font-semibold text-gray-400 text-sm">
                                    <div className="sm:w-2/5">Variação</div>
                                    <div className="sm:w-1/5">Custo</div>
                                    <div className="sm:w-1/5">Venda</div>
                                    <div className="sm:w-1/5">Estoque</div>
                                    <div className="justify-start" style={{ flexBasis: '60px', flexShrink: 0 }}>Ações</div>
                                  </div>

                                  {product.variations.map(variation => (
                                    <div key={variation.id} className="flex flex-col sm:flex-row sm:items-center py-2 border-t border-white/10 ml-4">
                                      <div className="w-full sm:w-2/5 text-gray-300 mb-1 sm:mb-0">{variation.variationName}</div>
                                      <div className="w-full sm:w-1/5 text-gray-300">
                                        <span className="font-semibold text-gray-400 sm:hidden">Custo: </span>
                                        R$ {Number(variation.preco_custo).toFixed(2)}
                                      </div>
                                      <div className="w-full sm:w-1/5 text-gray-300">
                                        <span className="font-semibold text-gray-400 sm:hidden">Venda: </span>
                                        R$ {Number(variation.preco).toFixed(2)}
                                      </div>
                                      <div className="w-full sm:w-1/5 text-gray-300">
                                        <span className="font-semibold text-gray-400 sm:hidden">Estoque: </span>
                                        {variation.quantidade_estoque}
                                      </div>
                                      <div className="flex gap-4 mt-2 sm:mt-0" style={{ flexBasis: '60px', flexShrink: 0 }}>
                                        <button onClick={() => openModal(variation)} className="text-yellow-300 hover:text-yellow-100" title="Editar"><Edit size={18} /></button>
                                        <button onClick={() => openDeleteModal(variation)} className="text-red-400 hover:text-red-300" title="Excluir"><Trash2 size={18} /></button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center p-4 text-gray-200">
                              <div className="w-full sm:w-2/5 font-medium mb-1 sm:mb-0">{product.nome}</div>
                              <div className="w-full sm:w-1/5 text-gray-300">
                                <span className="font-semibold text-gray-400 sm:hidden">Custo: </span>
                                R$ {product.preco_custo ? Number(product.preco_custo).toFixed(2) : 'N/A'}
                              </div>
                              <div className="w-full sm:w-1/5 text-gray-300">
                                <span className="font-semibold text-gray-400 sm:hidden">Venda: </span>
                                R$ {Number(product.preco).toFixed(2)}
                              </div>
                              <div className="w-full sm:w-1/5 text-gray-300">
                                <span className="font-semibold text-gray-400 sm:hidden">Estoque: </span>
                                {product.quantidade_estoque}
                              </div>
                              <div className="flex gap-4 mt-2 sm:mt-0" style={{ flexBasis: '60px', flexShrink: 0 }}>
                                <button onClick={() => openModal(product)} className="text-yellow-300 hover:text-yellow-100" title="Editar"><Edit size={18} /></button>
                                <button onClick={() => openDeleteModal(product)} className="text-red-400 hover:text-red-300" title="Excluir"><Trash2 size={18} /></button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-gray-400"><p>Nenhum produto encontrado.</p></div>
            )}

          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">{editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}</h2>
            <form onSubmit={handleFormSubmit}>
              <div className="mb-4 text-gray-800">
                <label className="block text-gray-700 mb-2">Nome do Produto (use "Principal: Variação")</label>
                <input type="text" value={newProduct.nome} onChange={(e) => setNewProduct({ ...newProduct, nome: e.target.value })} className="w-full p-2 border rounded" required />
              </div>
              <div className="mb-4 text-gray-800">
                <label className="block text-gray-700 mb-2">Descrição</label>
                <textarea value={newProduct.descricao} onChange={(e) => setNewProduct({ ...newProduct, descricao: e.target.value })} className="w-full p-2 border rounded" rows="2" placeholder="Ex: Pão baguete selado, carne desfiada..."></textarea>
              </div>
              <div className="mb-4  text-gray-800">
                <label className="block text-gray-700 mb-2">Categoria</label>
                <select value={newProduct.categoria} onChange={(e) => setNewProduct({ ...newProduct, categoria: e.target.value })} className="w-full p-2 border rounded text-gray-800" required >
                  {categories.length === 0 && <option value="Lanches">Lanches</option>}
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.nome}>{cat.nome}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-gray-700 mb-2">Custo (R$)</label>
                  <input type="number" step="0.01" value={newProduct.preco_custo} onChange={(e) => setNewProduct({ ...newProduct, preco_custo: e.target.value })} className="w-full p-2 border rounded  text-gray-800" required />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Venda (R$)</label>
                  <input type="number" step="0.01" value={newProduct.preco} onChange={(e) => setNewProduct({ ...newProduct, preco: e.target.value })} className="w-full p-2 border rounded  text-gray-800" required />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Estoque</label>
                  <input type="number" value={newProduct.quantidade_estoque} onChange={(e) => setNewProduct({ ...newProduct, quantidade_estoque: e.target.value })} className="w-full p-2 border rounded  text-gray-800" required />
                </div>
              </div>
              <div className="flex justify-end gap-4">
                <button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-200 rounded-lg  text-gray-800">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-[#A16207] text-white rounded-lg">{editingProduct ? 'Salvar Alterações' : 'Adicionar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md h-[500px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Gerenciar Categorias</h2>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <XCircle size={24} />
              </button>
            </div>

            {/* Formulário de Adicionar/Editar */}
            <form onSubmit={handleCategorySubmit} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="mb-4 text-gray-800">
                <label className="block text-gray-700 mb-2 font-medium">
                  {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    className="flex-1 p-2 border rounded focus:ring-2 focus:ring-purple-600 focus:outline-none"
                    placeholder="Nome da categoria"
                    required
                  />
                  <button type="submit" className={`px-4 py-2 text-white rounded-lg transition-colors ${editingCategory ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-purple-600 hover:bg-purple-700'}`}>
                    {editingCategory ? 'Salvar' : 'Criar'}
                  </button>
                </div>
              </div>
              {editingCategory && (
                <button type="button" onClick={cancelEditCategory} className="text-sm text-gray-500 underline">Cancelar Edição</button>
              )}
            </form>

            {/* Lista de Categorias */}
            <div className="flex-1 overflow-y-auto border-t border-gray-100 pt-4">
              <h3 className="text-gray-700 font-semibold mb-3">Categorias Existentes</h3>
              <div className="space-y-2">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border hover:bg-gray-100 transition-colors">
                    <span className="text-gray-800 font-medium">{cat.nome}</span>
                    <div className="flex gap-2">
                      <button onClick={() => startEditCategory(cat)} className="p-1 text-yellow-600 hover:bg-yellow-100 rounded" title="Editar">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => deleteCategory(cat.id)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Excluir">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="text-gray-500 text-center italic">Nenhuma categoria cadastrada.</p>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-10 rounded-lg shadow-xl w-full max-w-sm text-center">
            <XCircle size={50} className="text-red-500 mx-auto mb-4 " />
            <h2 className="text-xl font-bold mb-2">Confirmar Exclusão</h2>
            <p className="text-gray-600 mb-6">Tem certeza que quer excluir "{productToDelete?.nome}"? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-center gap-4">
              <button onClick={closeDeleteModal} className="px-6 py-2 bg-gray-200 rounded-lg font-semibold">Cancelar</button>
              <button onClick={handleDeleteConfirm} className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {notification.show && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-10 rounded-lg shadow-xl w-full max-w-sm text-center">
            <CheckCircle size={50} className="text-green-500 mx-auto mb-4 " />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Sucesso!</h2>
            <p className="text-gray-700 mb-6">{notification.message}</p>
            <button onClick={() => setNotification({ show: false, message: '' })} className="mt-4 px-6 py-2 bg-[#A16207] text-white rounded-lg font-semibold">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
