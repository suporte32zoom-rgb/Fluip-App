export interface DebitoPedagio {
  id: string;
  placa: string;
  placaEstrangeira?: boolean;
  concessionaria: string;
  rodovia: string;
  trechoKm?: string;
  portico: string;
  sentido: string;
  categoriaVeiculo: string;
  dataHora: string;
  dataHoraFormatada: string;
  valorTarifa: number;
  taxaEstradapay?: number;
  valorTotalComTaxa?: number;
  municipio?: string;
  uf?: string;
  dataLimiteInfracao: string;
  limiteInfracao?: string;
  dataLimiteFormatada: string;
  diasRestantes: number;
  status: 'PENDENTE' | 'PAGO';
  origemFonte?: string;
}

declare class PedagioService {
  validarEFormatarPlaca(placa: string, placaEstrangeira?: boolean): string;
  consultarDebitosPorPlaca(placaBruta: string, placaEstrangeira?: boolean): Promise<DebitoPedagio[]>;
  buscarPorIds(ids: string[]): DebitoPedagio[];
  baixarPassagens(ids: string[]): void;
}

declare const pedagioService: PedagioService;
export default pedagioService;
