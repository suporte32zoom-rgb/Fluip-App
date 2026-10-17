export interface OpcaoParcela {
  numero: number;
  valorParcela: number;
  valorTotalComJuros: number;
  descricao: string;
}

export interface CobrancaPix {
  txid: string;
  placa: string;
  formaDePagamento?: 'pix' | 'credito' | 'debito';
  passagensIds: string[];
  passagensDetalhadas: unknown[];
  subtotal: number;
  taxaConveniencia: number;
  valorTotal: number;
  pixCopiaECola?: string | null;
  qrCodeBase64?: string | null;
  opcoesParcelamento?: OpcaoParcela[] | null;
  formularioCartao?: unknown;
  createdAt: string;
  expiresAt: string;
  tempoLimiteSegundos: number;
  status: 'PENDENTE' | 'PAGO' | 'EXPIRADO';
  autenticacaoBancaria: string | null;
  protocoloConcessionaria?: string;
  comprovante: unknown;
  pagoEm?: string;
}

declare class PagamentoService {
  calcularTaxa(valorTotalPedagios: number, percentual?: number | null, taxaMinima?: number | null): number;
  gerarCobranca(passagensIds: string[], taxaConveniencia?: number | null, placa?: string, formaDePagamento?: 'pix' | 'credito' | 'debito'): CobrancaPix;
  gerarCobrancaPix(passagensIds: string[], taxaConveniencia?: number | null, placa?: string): CobrancaPix;
  consultarStatusPix(txid: string): CobrancaPix | null;
  confirmarPagamento(txid: string, detalhesPagamento?: unknown): CobrancaPix;
}

declare const pagamentoService: PagamentoService;
export default pagamentoService;
