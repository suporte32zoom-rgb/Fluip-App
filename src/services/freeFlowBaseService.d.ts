export interface FreeFlowPortico {
  id: string;
  concessionaria: string;
  rodovia: string;
  sigla?: string;
  km: string;
  municipio: string;
  uf: string;
  sentido?: string;
  tarifaBase: number;
  prazoPagamentoDias: number;
  status: string;
  tipoVia?: string;
  localizacaoDescricao?: string;
  coordenadas?: { lat: number; lng: number };
  formasDePagamento?: string[];
  fonteOriginal?: string;
}

export interface FreeFlowMetadados {
  fonte: string;
  licenca: string;
  repositorio: string;
  dataSincronizacao?: string;
  origem: string;
  totalPorticos: number;
  notaLegal?: string;
}

export interface FreeFlowCruzamento {
  rodoviaOficial: string;
  trechoKmOficial: string;
  concessionariaOficial: string;
  municipioOficial: string;
  ufOficial: string;
  tarifaOficialBase: number;
  statusPortico: string;
  prazoPagamentoDias: number;
  origemFonte: string;
}

export interface FreeFlowBaseService {
  obterPorticos(filtros?: { uf?: string; q?: string; status?: string }): {
    metadados: FreeFlowMetadados;
    total: number;
    porticos: FreeFlowPortico[];
  };
  sincronizarComGitHub(forcar?: boolean): Promise<{
    sucesso: boolean;
    fonte: string;
    total?: number;
    dataSincronizacao?: string;
    aviso?: string;
  }>;
  cruzarTrechoComBase(passagem?: Record<string, unknown>): FreeFlowCruzamento;
}

declare const freeFlowBaseService: FreeFlowBaseService;
export default freeFlowBaseService;
