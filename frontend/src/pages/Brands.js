import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { Plus, Search, Edit, Trash2, X, Tag, LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';

const Brands = () => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    ativo: true
  });

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const response = await api.get('/brands/');
      setBrands(response.data);
    } catch (error) {
      console.error('Failed to fetch brands:', error);
      toast.error('Erro ao carregar marcas');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBrand) {
        await api.put(`/brands/${editingBrand.id}`, formData);
        toast.success('Marca atualizada com sucesso');
      } else {
        await api.post('/brands/', formData);
        toast.success('Marca criada com sucesso');
      }
      setShowModal(false);
      setEditingBrand(null);
      setFormData({ nome: '', codigo: '', ativo: true });
      fetchBrands();
    } catch (error) {
      console.error('Failed to save brand:', error);
      toast.error(error.response?.data?.detail || 'Erro ao guardar marca');
    }
  };

  const handleEdit = (brand) => {
    setEditingBrand(brand);
    setFormData({
      nome: brand.nome,
      codigo: brand.codigo || '',
      ativo: brand.ativo
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja eliminar esta marca?')) return;
    
    try {
      await api.delete(`/brands/${id}`);
      toast.success('Marca eliminada com sucesso');
      fetchBrands();
    } catch (error) {
      console.error('Failed to delete brand:', error);
      toast.error(error.response?.data?.detail || 'Erro ao eliminar marca');
    }
  };

  const openNewModal = () => {
    setEditingBrand(null);
    setFormData({ nome: '', codigo: '', ativo: true });
    setShowModal(true);
  };

  const filteredBrands = brands.filter(brand => 
    brand.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (brand.codigo && brand.codigo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const actions = (
    <button
      onClick={openNewModal}
      data-testid="create-brand-button"
      className="bg-slate-900 text-white hover:bg-slate-800 h-9 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors flex items-center space-x-2"
    >
      <Plus className="w-4 h-4" />
      <span>Nova Marca</span>
    </button>
  );

  if (loading) {
    return (
      <MainLayout title="Marcas" actions={actions}>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">A carregar...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Marcas" actions={actions}>
      <div data-testid="brands-page" className="space-y-6">
        {/* Search and View Toggle */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar por nome ou codigo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="search-brands-input"
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
              />
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                data-testid="view-mode-grid"
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Vista em Grid"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                data-testid="view-mode-list"
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Vista em Lista"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredBrands.length > 0 ? (
              filteredBrands.map((brand) => (
                <div 
                  key={brand.id} 
                  className={`bg-white border rounded-lg shadow-sm overflow-hidden transition-all hover:shadow-md ${
                    brand.ativo ? 'border-slate-200' : 'border-slate-200 opacity-60'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                          <Tag className="w-6 h-6 text-slate-400" />
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-900">{brand.nome}</h3>
                          {brand.codigo && (
                            <p className="text-xs text-slate-500 font-mono">{brand.codigo}</p>
                          )}
                        </div>
                      </div>
                      {!brand.ativo && (
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                          Inativo
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end space-x-2">
                    <button
                      onClick={() => handleEdit(brand)}
                      data-testid={`edit-brand-${brand.id}`}
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(brand.id)}
                      data-testid={`delete-brand-${brand.id}`}
                      className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full">
                <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
                  <Tag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Nenhuma marca encontrada</p>
                  <button 
                    onClick={openNewModal}
                    className="mt-4 text-sm text-slate-900 hover:underline"
                  >
                    Criar primeira marca
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <th className="h-10 px-4 text-left">Nome</th>
                  <th className="h-10 px-4 text-left">Codigo</th>
                  <th className="h-10 px-4 text-center">Estado</th>
                  <th className="h-10 px-4 text-center">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredBrands.length > 0 ? (
                  filteredBrands.map((brand) => (
                    <tr 
                      key={brand.id} 
                      className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${
                        !brand.ativo ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                            <Tag className="w-4 h-4 text-slate-400" />
                          </div>
                          <span className="font-medium text-slate-900">{brand.nome}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-slate-600">{brand.codigo || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                          brand.ativo 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          {brand.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => handleEdit(brand)}
                            data-testid={`edit-brand-list-${brand.id}`}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(brand.id)}
                            data-testid={`delete-brand-list-${brand.id}`}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-slate-400">
                      Nenhuma marca encontrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            
            {/* Footer with count */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-sm text-slate-500">
              {filteredBrands.length} marcas
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingBrand ? 'Editar Marca' : 'Nova Marca'}
              </h2>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                  data-testid="brand-name-input"
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  placeholder="Nome da marca"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Codigo
                </label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  data-testid="brand-code-input"
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  placeholder="Codigo identificador"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900"
                />
                <label htmlFor="ativo" className="text-sm text-slate-700">
                  Marca ativa
                </label>
              </div>
              
              <div className="flex space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  data-testid="save-brand-button"
                  className="flex-1 bg-slate-900 text-white hover:bg-slate-800 h-9 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors"
                >
                  {editingBrand ? 'Atualizar' : 'Criar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 h-9 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default Brands;
