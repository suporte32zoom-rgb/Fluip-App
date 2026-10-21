import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';

export interface DebitoPedagioItem {
  id: string;
  placa: string;
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
  dataLimiteFormatada: string;
  diasRestantes: number;
  status: 'PENDENTE' | 'PAGO';
  origemFonte?: string;
}

export interface CobrancaPixResposta {
  success: boolean;
  txid: string;
  placa: string;
  formaDePagamento?: 'pix';
  passagensIds?: string[];
  pixCopiaECola?: string | null;
  qrCodeBase64?: string | null;
  valorTotal: number;
  resumo: {
    passagensQuantidade: number;
    subtotal: number;
    taxaConveniencia: number;
    totalGeral: number;
  };
  expiresAt: string;
  tempoLimiteSegundos: number;
  status: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private http = inject(HttpClient);

  // Form Control para a Placa (aceita 7 ou 8 caracteres com hífen)
  placaControl = new FormControl('', [
    Validators.required,
    Validators.minLength(7),
    Validators.maxLength(8),
  ]);

  // Sinais de Estado
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  successToast = signal<string | null>(null);
  
  placaPesquisada = signal<string>('');
  debitos = signal<DebitoPedagioItem[]>([]);
  selecionadosIds = signal<Set<string>>(new Set());
  taxaFixa = signal<number>(1.00);

  // Tipo de Placa Detectada: 'mercosul' | 'antiga' | 'estrangeira' | 'neutro'
  tipoPlaca = signal<'mercosul' | 'antiga' | 'estrangeira' | 'neutro'>('neutro');
  placaEstrangeira = signal<boolean>(false);

  // Aceite Legal e LGPD
  consentimentoTermos = signal<boolean>(false);
  consentimentoPrivacidade = signal<boolean>(false);
  modalTermosAberto = signal<boolean>(false);
  modalPrivacidadeAberto = signal<boolean>(false);
  faqAberto = signal<number | null>(null);

  // Forma de pagamento exclusiva via PIX
  formaPagamento = signal<'pix'>('pix');

  // Modal e Cobrança
  modalPixAberto = signal(false);
  cobrancaAtiva = signal<CobrancaPixResposta | null>(null);
  pixCopiado = signal(false);
  segundosRestantes = signal(900);
  pagamentoConcluido = signal(false);
  dadosComprovante = signal<{
    placa: string;
    formaPagamento: string;
    valorTotal: number;
    protocolo: string;
    autenticacao: string;
    dataHora: string;
  } | null>(null);

  // PWA Install prompt
  pwaInstallEvent = signal<Event | null>(null);
  showIosGuide = signal(false);

  // Estado Computado de Validação de Busca
  podeConsultar = computed(() => this.consentimentoTermos() && this.consentimentoPrivacidade());

  // Estado Computado do Resumo Financeiro
  debitosSelecionados = computed(() => {
    const ids = this.selecionadosIds();
    return this.debitos().filter((d) => ids.has(d.id));
  });

  subtotal = computed(() => {
    return this.debitosSelecionados().reduce((acc, curr) => acc + curr.valorTarifa, 0);
  });

  taxaCalculada = computed(() => {
    const sub = this.subtotal();
    if (this.debitosSelecionados().length === 0 || sub <= 0) return 0;
    return this.taxaFixa();
  });

  totalGeral = computed(() => {
    return Number((this.subtotal() + this.taxaCalculada()).toFixed(2));
  });

  todosSelecionados = computed(() => {
    const todos = this.debitos();
    return todos.length > 0 && this.selecionadosIds().size === todos.length;
  });

  tempoFormatado = computed(() => {
    const sec = this.segundosRestantes();
    const min = Math.floor(sec / 60);
    const remSec = sec % 60;
    return `${String(min).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
  });

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.pwaInstallEvent.set(e);
      });

      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js').then((reg) => {
            reg.update().catch((err) => {
              console.warn('SW update check:', err);
            });
          }).catch((err) => {
            console.warn('SW register check:', err);
          });
        });
      }
    }
  }

  formatarPlacaInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let raw = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (raw.length > 7) {
      raw = raw.substring(0, 7);
    }

    let formatted = raw;
    let tipo: 'mercosul' | 'antiga' | 'neutro' = 'neutro';

    const char4 = raw[3] || '';
    const char5 = raw[4] || '';

    const isChar4Num = /[0-9]/.test(char4);
    const isChar5Num = /[0-9]/.test(char5);
    const isChar5Letter = /[A-Z]/.test(char5);

    if (raw.length >= 5) {
      if (isChar4Num && isChar5Letter) {
        // Mercosul: ABC1D23
        tipo = 'mercosul';
        formatted = raw;
      } else if (isChar4Num && isChar5Num) {
        // Tradicional: ABC-1234
        tipo = 'antiga';
        formatted = `${raw.substring(0, 3)}-${raw.substring(3)}`;
      }
    }

    this.tipoPlaca.set(tipo);
    this.placaControl.setValue(formatted, { emitEvent: false });
  }
  togglePlacaEstrangeira(event: Event) {
    const input = event.target as HTMLInputElement;
    const ativo = input.checked;
    this.placaEstrangeira.set(ativo);
    if (ativo) {
      this.tipoPlaca.set('estrangeira');
      this.mostrarToast('Modo de Placa Estrangeira ativado.');
    } else {
      this.tipoPlaca.set('neutro');
    }
  }

  toggleFaq(index: number) {
    this.faqAberto.update((curr) => (curr === index ? null : index));
  }

  usarPlacaExemplo(placa: string) {
    this.placaControl.setValue(placa);
    if (placa === 'AF123CD') {
      this.placaEstrangeira.set(true);
      this.tipoPlaca.set('estrangeira');
    } else {
      this.placaEstrangeira.set(false);
      const raw = placa.replace(/[^A-Z0-9]/gi, '');
      const isMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(raw);
      this.tipoPlaca.set(isMercosul ? 'mercosul' : 'antiga');
    }
    this.consentimentoTermos.set(true);
    this.consentimentoPrivacidade.set(true);
    this.consultarDebitos();
  }

  consultarDebitos() {
    if (!this.podeConsultar()) {
      this.mostrarToast('Por favor, aceite os Termos de Uso e a Política de Privacidade (LGPD).');
      return;
    }

    const valorBruto = (this.placaControl.value || '').trim().toUpperCase();
    const limpa = valorBruto.replace(/[^A-Z0-9]/gi, '');
    const minCarac = this.placaEstrangeira() ? 4 : 7;

    if (limpa.length < minCarac) {
      this.mostrarToast(this.placaEstrangeira()
        ? 'Digite ao menos 4 caracteres para a placa estrangeira.'
        : 'Digite uma placa válida com 7 caracteres (ex: ABC1D23 ou ABC-1234).'
      );
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.http.get<{ success: boolean; placa: string; debitos: DebitoPedagioItem[]; resumo: { taxaConveniencia: number } }>(
      `/api/v1/consultar?placa=${encodeURIComponent(limpa)}&estrangeira=${this.placaEstrangeira()}`
    ).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.placaPesquisada.set(res.placa);
          this.debitos.set(res.debitos);
          if (res.resumo?.taxaConveniencia !== undefined) {
            this.taxaFixa.set(res.resumo.taxaConveniencia || 1.00);
          }
          this.selecionadosIds.set(new Set(res.debitos.map((d) => d.id)));
        }
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err.error?.error || 'Erro ao consultar placa. Verifique os dados digitados.';
        this.errorMessage.set(msg);
        this.mostrarToast(msg);
      },
    });
  }

  toggleSelecao(id: string) {
    const atuais = new Set(this.selecionadosIds());
    if (atuais.has(id)) {
      atuais.delete(id);
    } else {
      atuais.add(id);
    }
    this.selecionadosIds.set(atuais);
  }

  toggleSelecionarTodos() {
    if (this.todosSelecionados()) {
      this.selecionadosIds.set(new Set());
    } else {
      this.selecionadosIds.set(new Set(this.debitos().map((d) => d.id)));
    }
  }

  iniciarCheckout() {
    const ids = Array.from(this.selecionadosIds());
    if (ids.length === 0) {
      this.mostrarToast('Selecione ao menos um pedágio para efetuar o pagamento.');
      return;
    }

    this.loading.set(true);

    this.http.post<CobrancaPixResposta>('/api/v1/pagar', {
      placa: this.placaPesquisada(),
      passagensIds: ids,
      formaDePagamento: 'pix',
    }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.cobrancaAtiva.set(res);
          this.abrirModalPix(res);
        }
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err.error?.error || 'Erro ao preparar cobrança PIX.';
        this.mostrarToast(msg);
      },
    });
  }

  abrirModalPix(cobranca: CobrancaPixResposta) {
    this.modalPixAberto.set(true);
    this.pagamentoConcluido.set(false);
    this.pixCopiado.set(false);
    this.segundosRestantes.set(cobranca.tempoLimiteSegundos || 900);

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      const atual = this.segundosRestantes() - 1;
      this.segundosRestantes.set(atual);
      if (atual <= 0) {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.mostrarToast('Prazo de 15 minutos expirado. Gere uma nova cobrança.');
        this.fecharModalPix();
      }
    }, 1000);

    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      this.verificarStatusPix(cobranca.txid);
    }, 3000);
  }

  fecharModalPix() {
    this.modalPixAberto.set(false);
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  verificarStatusPix(txid: string) {
    this.http.get<{ success: boolean; status: string; autenticacaoBancaria?: string; protocoloConcessionaria?: string; comprovante?: { formaDePagamento?: string } }>(
      `/api/v1/status/${txid}`
    ).subscribe({
      next: (res) => {
        if (res.success && res.status === 'PAGO') {
          this.confirmarSucesso(res.protocoloConcessionaria, res.autenticacaoBancaria, res.comprovante?.formaDePagamento);
        }
      },
      error: (err) => {
        console.warn('Status poll:', err);
      },
    });
  }

  simularPagamentoInstantaneo() {
    const cobranca = this.cobrancaAtiva();
    if (!cobranca) return;

    this.loading.set(true);
    this.http.post<{ success: boolean; cobranca: { protocoloConcessionaria: string; autenticacaoBancaria: string; comprovante?: { formaDePagamento?: string } } }>(
      `/api/v1/simular-pagamento/${cobranca.txid}`,
      {}
    ).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.confirmarSucesso(res.cobranca.protocoloConcessionaria, res.cobranca.autenticacaoBancaria, 'PIX Instantâneo');
          this.mostrarToast('Pagamento confirmado e baixa registrada!');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.mostrarToast(err.error?.error || 'Erro ao simular quitação.');
      },
    });
  }

  private confirmarSucesso(protocolo?: string, autenticacao?: string, forma?: string) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);

    const cobranca = this.cobrancaAtiva();
    this.dadosComprovante.set({
      placa: cobranca?.placa || this.placaPesquisada(),
      formaPagamento: forma || 'PIX Instantâneo',
      valorTotal: cobranca?.valorTotal || this.totalGeral(),
      protocolo: protocolo || `PROT-${Math.floor(100000 + Math.random() * 900000)}`,
      autenticacao: autenticacao || `AUT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      dataHora: new Date().toLocaleString('pt-BR'),
    });

    this.pagamentoConcluido.set(true);

    const idsPagos = new Set(cobranca?.passagensIds || []);
    const restantes = this.debitos().filter((d) => !idsPagos.has(d.id));
    this.debitos.set(restantes);
    this.selecionadosIds.set(new Set());
  }

  copiarChavePix() {
    const codigo = this.cobrancaAtiva()?.pixCopiaECola || '';
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(codigo).then(() => {
        this.pixCopiado.set(true);
        this.mostrarToast('Código PIX Copia e Cola copiado com sucesso!');
        setTimeout(() => this.pixCopiado.set(false), 3000);
      });
    }
  }

  instalarPwa() {
    const promptEvent = this.pwaInstallEvent() as { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: string }> } | null;
    if (promptEvent && promptEvent.prompt) {
      promptEvent.prompt();
      if (promptEvent.userChoice) {
        promptEvent.userChoice.then((choice) => {
          if (choice.outcome === 'accepted') {
            this.pwaInstallEvent.set(null);
            this.mostrarToast('Estradapay instalado com sucesso!');
          }
        });
      }
    } else {
      this.showIosGuide.set(true);
    }
  }

  novaConsulta() {
    this.fecharModalPix();
    this.placaControl.setValue('');
    this.tipoPlaca.set('neutro');
    this.placaPesquisada.set('');
    this.debitos.set([]);
    this.selecionadosIds.set(new Set());
  }

  mostrarToast(msg: string) {
    this.successToast.set(msg);
    setTimeout(() => {
      this.successToast.set(null);
    }, 3500);
  }
}
