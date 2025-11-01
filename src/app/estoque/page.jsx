'use client';

// importamos useRef e os novos ícones
import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PlusCircle, Edit, Trash2, ArrowLeft, XCircle, Search, ChevronDown, CheckCircle, 
  Download, Upload // Ícones de Download e Upload
} from 'lucide-react';

// Importar a biblioteca xlsx
import * as XLSX from 'xlsx';

export default function EstoquePage() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({ nome: '', preco: '', preco_custo: '', quantidade_estoque: '', categoria: 'Lanches', descricao: '' });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [openVariations, setOpenVariations] = useState({});
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
          parents[parentName] = { isParent: true, nome: parentName, categoria: product.categoria, variations: [] };
        }
        parents[parentName].variations.push({ ...product, variationName });
      } else {
        standalone.push(product);
      }
    });

    const groupedList = Object.values(parents);
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
        categoria: product.categoria || 'Lanches',
        descricao: product.descricao || ''
      });
    } else {
      setEditingProduct(null);
      setNewProduct({ nome: '', preco: '', preco_custo: '', quantidade_estoque: '', categoria: 'Lanches', descricao: '' });
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
      // Você pode adicionar mais colunas se quiser (ex: categoria, descricao)
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
              
              {/* NOVO: Cabeçalho da tabela, visível em telas sm e maiores */}
              <div className="hidden sm:flex items-center p-4 text-gray-300 font-bold bg-white/10 rounded-lg">
                  <div className="w-2/5">Produto</div>
                  <div className="w-1/5">Custo</div>
                  <div className="w-1/5">Venda</div>
                  <div className="w-1/5">Estoque</div>
                  <div className="justify-start" style={{ flexBasis: '60px', flexShrink: 0 }}>Ações</div>
              </div>

              {processedProducts.map((product) => (
                  <div key={product.nome} className="bg-white/5 rounded-lg">
                      {product.isParent ? (
                          <>
                              <div onClick={() => toggleVariations(product.nome)} className="flex items-center p-4 cursor-pointer">
                                  <div className="flex-1 font-medium text-white">{product.nome} ({product.variations.length} variações)</div>
                                  <ChevronDown className={`text-gray-300 transition-transform ${openVariations[product.nome] ? 'rotate-180' : ''}`} size={20} />
                              </div>
                              {openVariations[product.nome] && (
                                  <div className="px-4 pb-2">
                                      
                                      {/* Cabeçalho de variações (agora só aparece em telas sm+) */}
                                      <div className="hidden sm:flex items-center py-2 border-t border-white/10 ml-4 font-semibold text-gray-400 text-sm">
                                          <div className="sm:w-2/5">Variação</div>
                                          <div className="sm:w-1/5">Custo</div>
                                          <div className="sm:w-1/5">Venda</div>
                                          <div className="sm:w-1/5">Estoque</div>
                                          <div className="justify-start" style={{ flexBasis: '60px', flexShrink: 0 }}>Ações</div>
                                      </div>

                                      {product.variations.map(variation => (
                                          // Default: flex-col (celular), sm:flex-row (desktop)
                                          <div key={variation.id} className="flex flex-col sm:flex-row sm:items-center py-2 border-t border-white/10 ml-4">
                                              {/* Nome: w-full no celular, sm:w-2/5 no desktop */}
                                              <div className="w-full sm:w-2/5 text-gray-300 mb-1 sm:mb-0">{variation.variationName}</div>
                                              
                                              {/* Custo */}
                                              <div className="w-full sm:w-1/5 text-gray-300">
                                                  <span className="font-semibold text-gray-400 sm:hidden">Custo: </span>
                                                  R$ {Number(variation.preco_custo).toFixed(2)}
                                              </div>
                                              {/* Venda */}
                                              <div className="w-full sm:w-1/5 text-gray-300">
                                                  <span className="font-semibold text-gray-400 sm:hidden">Venda: </span>
                                                  R$ {Number(variation.preco).toFixed(2)}
                                              </div>
                                              {/* Estoque */}
                                              <div className="w-full sm:w-1/5 text-gray-300">
                                                  <span className="font-semibold text-gray-400 sm:hidden">Estoque: </span>
                                                  {variation.quantidade_estoque}
                                              </div>
                                              
                                              {/* Ações: Adiciona margem no celular (mt-2), zera no desktop (sm:mt-0) */}
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
                          // Default: flex-col (celular), sm:flex-row (desktop)
                          <div className="flex flex-col sm:flex-row sm:items-center p-4 text-gray-200">
                              {/* Nome */}
                              <div className="w-full sm:w-2/5 font-medium mb-1 sm:mb-0">{product.nome}</div>
                              
                              {/* Custo */}
                              <div className="w-full sm:w-1/5 text-gray-300">
                                  <span className="font-semibold text-gray-400 sm:hidden">Custo: </span>
                                  R$ {product.preco_custo ? Number(product.preco_custo).toFixed(2) : 'N/A'}
                              </div>
                              {/* Venda */}
                              <div className="w-full sm:w-1/5 text-gray-300">
                                  <span className="font-semibold text-gray-400 sm:hidden">Venda: </span>
                                  R$ {Number(product.preco).toFixed(2)}
                              </div>
                              {/* Estoque */}
                              <div className="w-full sm:w-1/5 text-gray-300">
                                  <span className="font-semibold text-gray-400 sm:hidden">Estoque: </span>
                                  {product.quantidade_estoque}
                              </div>
                              
                              {/* Ações: Adiciona margem no celular (mt-2), zera no desktop (sm:mt-0) */}
                              <div className="flex gap-4 mt-2 sm:mt-0" style={{ flexBasis: '60px', flexShrink: 0 }}>
                                  <button onClick={() => openModal(product)} className="text-yellow-300 hover:text-yellow-100" title="Editar"><Edit size={18} /></button>
                                  <button onClick={() => openDeleteModal(product)} className="text-red-400 hover:text-red-300" title="Excluir"><Trash2 size={18} /></button>
                              </div>
                          </div>
                      )}
                  </div>
              ))}
            </div>

            {processedProducts.length === 0 && ( <div className="text-center py-10 text-gray-400"><p>Nenhum produto encontrado.</p></div> )}
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
                <select value={newProduct.categoria} onChange={(e) => setNewProduct({ ...newProduct, categoria: e.target.value })} className="w-full p-2 border rounded  text-gray-800" required >
                    <option value="Lanches">Lanches</option>
                    <option value="Supremo Grill">Supremo Grill</option>
                    <option value="Bebidas Especiais">Bebidas Especiais</option>
                    <option value="Bebidas">Bebidas</option>
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
                  <input type="number" value={newProduct.quantidade_estoque} onChange={(e) => setNewProduct({ ...newSocial, quantidade_estoque: e.target.value })} className="w-full p-2 border rounded  text-gray-800" required />
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