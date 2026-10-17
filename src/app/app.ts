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

export interface CobrancaPixResposta {
  success: boolean;
  txid: string;
  placa: string;
  passagensIds?: string[];
  pixCopiaECola: string;
  qrCodeBase64: string;
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

  // Form Control para a Placa
  placaControl = new FormControl('', [
    Validators.required,
    Validators.minLength(7),
    Validators.maxLength(7),
  ]);

  // Sinais de Estado
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  successToast = signal<string | null>(null);
  
  placaPesquisada = signal<string>('');
  debitos = signal<DebitoPedagioItem[]>([]);
  selecionadosIds = signal<Set<string>>(new Set());
  taxaConveniencia = signal<number>(2.50);

  // Modal Pix
  modalPixAberto = signal(false);
  cobrancaAtiva = signal<CobrancaPixResposta | null>(null);
  pixCopiado = signal(false);
  segundosRestantes = signal(900);
  pagamentoConcluido = signal(false);
  dadosComprovante = signal<{
    placa: string;
    valorTotal: number;
    protocolo: string;
    autenticacao: string;
    dataHora: string;
  } | null>(null);

  // PWA Install prompt
  pwaInstallEvent = signal<Event | null>(null);
  showIosGuide = signal(false);

  // Estado Computado do Resumo Financeiro
  debitosSelecionados = computed(() => {
    const ids = this.selecionadosIds();
    return this.debitos().filter((d) => ids.has(d.id));
  });

  subtotal = computed(() => {
    return this.debitosSelecionados().reduce((acc, curr) => acc + curr.valorTarifa, 0);
  });

  taxaCalculada = computed(() => {
    return this.debitosSelecionados().length > 0 ? this.taxaConveniencia() : 0;
  });

  totalGeral = computed(() => {
    return this.subtotal() + this.taxaCalculada();
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
    }
  }

  formatarPlacaInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const formatado = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 7);
    this.placaControl.setValue(formatado, { emitEvent: false });
  }

  usarPlacaExemplo(placa: string) {
    this.placaControl.setValue(placa);
    this.consultarDebitos();
  }

  consultarDebitos() {
    const valor = (this.placaControl.value || '').trim().toUpperCase();
    if (valor.length < 7) {
      this.mostrarToast('Digite uma placa válida com 7 caracteres.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.http.get<{ success: boolean; placa: string; debitos: DebitoPedagioItem[]; resumo: { taxaConveniencia: number } }>(
      `/api/v1/consultar?placa=${encodeURIComponent(valor)}`
    ).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.placaPesquisada.set(res.placa);
          this.debitos.set(res.debitos);
          this.taxaConveniencia.set(res.resumo?.taxaConveniencia || 2.50);
          // Selecionar todos por padrão
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

  gerarPagamentoPix() {
    const ids = Array.from(this.selecionadosIds());
    if (ids.length === 0) {
      this.mostrarToast('Selecione ao menos um pedágio para efetuar o pagamento.');
      return;
    }

    this.loading.set(true);

    this.http.post<CobrancaPixResposta>('/api/v1/pagar', {
      placa: this.placaPesquisada(),
      passagensIds: ids,
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
        const msg = err.error?.error || 'Erro ao gerar Pix.';
        this.mostrarToast(msg);
      },
    });
  }

  abrirModalPix(cobranca: CobrancaPixResposta) {
    this.modalPixAberto.set(true);
    this.pagamentoConcluido.set(false);
    this.pixCopiado.set(false);
    this.segundosRestantes.set(cobranca.tempoLimiteSegundos || 900);

    // Iniciar contagem regressiva
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

    // Iniciar checagem periódica a cada 3 segundos
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
    this.http.get<{ success: boolean; status: string; autenticacaoBancaria?: string; protocoloConcessionaria?: string }>(
      `/api/v1/status/${txid}`
    ).subscribe({
      next: (res) => {
        if (res.success && res.status === 'PAGO') {
          this.confirmarSucesso(res.protocoloConcessionaria, res.autenticacaoBancaria);
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
    this.http.post<{ success: boolean; cobranca: { protocoloConcessionaria: string; autenticacaoBancaria: string } }>(
      `/api/v1/simular-pagamento/${cobranca.txid}`,
      {}
    ).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.confirmarSucesso(res.cobranca.protocoloConcessionaria, res.cobranca.autenticacaoBancaria);
          this.mostrarToast('Pagamento confirmado e baixa registrada!');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.mostrarToast(err.error?.error || 'Erro ao simular quitação.');
      },
    });
  }

  private confirmarSucesso(protocolo?: string, autenticacao?: string) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);

    const cobranca = this.cobrancaAtiva();
    this.dadosComprovante.set({
      placa: cobranca?.placa || this.placaPesquisada(),
      valorTotal: cobranca?.valorTotal || this.totalGeral(),
      protocolo: protocolo || `PROT-${Math.floor(100000 + Math.random() * 900000)}`,
      autenticacao: autenticacao || `AUT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      dataHora: new Date().toLocaleString('pt-BR'),
    });

    this.pagamentoConcluido.set(true);

    // Remover passagens pagas da lista
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
            this.mostrarToast('Fluip instalado com sucesso!');
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
