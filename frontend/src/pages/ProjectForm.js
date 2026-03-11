import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

const ProjectForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orderTypes, setOrderTypes] = useState([]);
  const [partners, setPartners] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [users, setUsers] = useState([]);
  const [brands, setBrands] = useState([]);
  
  const [formData, setFormData] = useState({
    of_numero: '',
    tipo_ordem_id: '',
    marca_id: '',
    modelo: '',
    quantidade: 100,
    comercial_responsavel_id: '',
    parceiro_confeccao_id: '',
    data_encomenda: new Date().toISOString().split('T')[0],
    data_prevista_entrega: '',
    data_entrada_confecao: '',
    producao_confirmada: false,
    producao_loteada: false,
    obriga_prototipo: false,
    fornecedor_tecido_id: '',
    referencia_tecido: '',
    descricao: '',
    observacoes: ''
  });

  useEffect(() => {
    fetchFormData();
    if (id) {
      fetchProject();
    }
  }, [id]);

  const fetchFormData = async () => {
    try {
      const [orderTypesRes, partnersRes, suppliersRes, usersRes, brandsRes] = await Promise.all([
        api.get('/order-types/'),
        api.get('/partners/'),
        api.get('/suppliers/'),
        api.get('/users/'),
        api.get('/brands/')
      ]);
      setOrderTypes(orderTypesRes.data);
      setPartners(partnersRes.data.filter(p => p.tipo_servico === 'confeccao'));
      setSuppliers(suppliersRes.data);
      setUsers(usersRes.data.filter(u => u.role === 'comercial'));
      setBrands(brandsRes.data.filter(b => b.ativo));
    } catch (error) {
      console.error('Failed to fetch form data:', error);
      toast.error('Erro ao carregar dados do formulário');
    }
  };

  const fetchProject = async () => {
    try {
      const response = await api.get(`/projects/${id}`);
      const project = response.data;
      setFormData({
        of_numero: project.of_numero,
        tipo_ordem_id: project.tipo_ordem_id,
        marca_id: project.marca_id || '',
        modelo: project.modelo,
        quantidade: project.quantidade,
        comercial_responsavel_id: project.comercial_responsavel_id || '',
        parceiro_confeccao_id: project.parceiro_confeccao_id || '',
        data_encomenda: project.data_encomenda?.split('T')[0] || '',
        data_prevista_entrega: project.data_prevista_entrega?.split('T')[0] || '',
        data_entrada_confecao: project.data_entrada_confecao?.split('T')[0] || '',
        producao_confirmada: project.producao_confirmada,
        producao_loteada: project.producao_loteada,
        obriga_prototipo: project.obriga_prototipo,
        fornecedor_tecido_id: project.fornecedor_tecido_id || '',
        referencia_tecido: project.referencia_tecido || '',
        descricao: project.descricao || '',
        observacoes: project.observacoes || ''
      });
    } catch (error) {
      console.error('Failed to fetch project:', error);
      toast.error('Erro ao carregar projeto');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        data_encomenda: new Date(formData.data_encomenda).toISOString(),
        data_prevista_entrega: new Date(formData.data_prevista_entrega).toISOString(),
        data_entrada_confecao: formData.data_entrada_confecao ? new Date(formData.data_entrada_confecao).toISOString() : null
      };

      if (id) {
        await api.put(`/projects/${id}`, payload);
        toast.success('Projeto atualizado com sucesso');
      } else {
        await api.post('/projects/', payload);
        toast.success('Projeto criado com sucesso');
      }
      navigate('/projects');
    } catch (error) {
      console.error('Failed to save project:', error);
      toast.error(error.response?.data?.detail || 'Erro ao guardar projeto');
    } finally {
      setLoading(false);
    }
  };

  const title = id ? 'Editar Projeto' : 'Novo Projeto';

  return (
    <MainLayout title={title}>
      <div data-testid="project-form-page" className="max-w-4xl">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Voltar para Projetos</span>
        </button>

        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Identificação */}
            <div>
              <h3 className="text-lg font-medium text-slate-900 mb-4 pb-2 border-b border-slate-200">
                Identificação
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">OF Número *</label>
                  <input
                    type="text"
                    value={formData.of_numero}
                    onChange={(e) => setFormData({ ...formData, of_numero: e.target.value })}
                    required
                    disabled={!!id}
                    data-testid="of-numero-input"
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Ordem *</label>
                  <select
                    value={formData.tipo_ordem_id}
                    onChange={(e) => setFormData({ ...formData, tipo_ordem_id: e.target.value })}
                    required
                    data-testid="tipo-ordem-select"
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  >
                    <option value="">Selecione...</option>
                    {orderTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
                  <select
                    value={formData.marca_id}
                    onChange={(e) => setFormData({ ...formData, marca_id: e.target.value })}
                    data-testid="marca-select"
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  >
                    <option value="">Selecione...</option>
                    {brands.map(brand => (
                      <option key={brand.id} value={brand.id}>{brand.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Modelo *</label>
                  <input
                    type="text"
                    value={formData.modelo}
                    onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                    required
                    data-testid="modelo-input"
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade *</label>
                  <input
                    type="number"
                    value={formData.quantidade}
                    onChange={(e) => setFormData({ ...formData, quantidade: parseInt(e.target.value) })}
                    required
                    min="1"
                    data-testid="quantidade-input"
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Responsáveis */}
            <div>
              <h3 className="text-lg font-medium text-slate-900 mb-4 pb-2 border-b border-slate-200">
                Responsáveis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Comercial Responsável</label>
                  <select
                    value={formData.comercial_responsavel_id}
                    onChange={(e) => setFormData({ ...formData, comercial_responsavel_id: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  >
                    <option value="">Selecione...</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confeção</label>
                  <select
                    value={formData.parceiro_confeccao_id}
                    onChange={(e) => setFormData({ ...formData, parceiro_confeccao_id: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  >
                    <option value="">Selecione...</option>
                    {partners.map(partner => (
                      <option key={partner.id} value={partner.id}>{partner.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Datas */}
            <div>
              <h3 className="text-lg font-medium text-slate-900 mb-4 pb-2 border-b border-slate-200">
                Datas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data Encomenda *</label>
                  <input
                    type="date"
                    value={formData.data_encomenda}
                    onChange={(e) => setFormData({ ...formData, data_encomenda: e.target.value })}
                    required
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data Entrada Confeção</label>
                  <input
                    type="date"
                    value={formData.data_entrada_confecao}
                    onChange={(e) => setFormData({ ...formData, data_entrada_confecao: e.target.value })}
                    data-testid="data-entrada-confecao-input"
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data Prevista Entrega *</label>
                  <input
                    type="date"
                    value={formData.data_prevista_entrega}
                    onChange={(e) => setFormData({ ...formData, data_prevista_entrega: e.target.value })}
                    required
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Tecido */}
            <div>
              <h3 className="text-lg font-medium text-slate-900 mb-4 pb-2 border-b border-slate-200">
                Tecido
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor Tecido</label>
                  <select
                    value={formData.fornecedor_tecido_id}
                    onChange={(e) => setFormData({ ...formData, fornecedor_tecido_id: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  >
                    <option value="">Selecione...</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.id}>{supplier.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Referência Tecido</label>
                  <input
                    type="text"
                    value={formData.referencia_tecido}
                    onChange={(e) => setFormData({ ...formData, referencia_tecido: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Opções de Produção */}
            <div>
              <h3 className="text-lg font-medium text-slate-900 mb-4 pb-2 border-b border-slate-200">
                Opções de Produção
              </h3>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.producao_confirmada}
                    onChange={(e) => setFormData({ ...formData, producao_confirmada: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-slate-900"
                  />
                  <span className="text-sm text-slate-700">Produção Confirmada</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.producao_loteada}
                    onChange={(e) => setFormData({ ...formData, producao_loteada: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-slate-900"
                  />
                  <span className="text-sm text-slate-700">Produção Loteada</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.obriga_prototipo}
                    onChange={(e) => setFormData({ ...formData, obriga_prototipo: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-slate-900"
                  />
                  <span className="text-sm text-slate-700">Obriga Protótipo</span>
                </label>
              </div>
            </div>

            {/* Descrição */}
            <div>
              <h3 className="text-lg font-medium text-slate-900 mb-4 pb-2 border-b border-slate-200">
                Descrição
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                  <textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    rows={3}
                    className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                  <textarea
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    rows={3}
                    className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3 pt-4 border-t border-slate-200">
              <button
                type="submit"
                disabled={loading}
                data-testid="save-project-button"
                className="bg-slate-900 text-white hover:bg-slate-800 h-9 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'A guardar...' : (id ? 'Atualizar' : 'Criar')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 h-9 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </MainLayout>
  );
};

export default ProjectForm;
