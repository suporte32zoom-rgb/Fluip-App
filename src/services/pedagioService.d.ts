export interface DebitoPedagio {
  id: string;
  placa: string;
  concessionaria: string;
  rodovia: string;
  portico: string;
  sentido: string;
  categoriaVeiculo: string;
  dataHora: string;
  dataHoraFormatada: string;
  valorTarifa: number;
  dataLimiteInfracao: string;
  dataLimiteFormatada: string;
  diasRestantes: number;
  status: 'PENDENTE' | 'PAGO';
}

declare class PedagioService {
  validarEFormatarPlaca(placa: string): string;
  consultarDebitosPorPlaca(placaBruta: string): Promise<DebitoPedagio[]>;
  buscarPorIds(ids: string[]): DebitoPedagio[];
  baixarPassagens(ids: string[]): void;
}

declare const pedagioService: PedagioService;
export default pedagioService;
