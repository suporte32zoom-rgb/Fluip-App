/**
 * ESTRADAPAY - Lógica do Aplicativo Frontend PWA
 * Suporte Completo: Placas Mercosul (ABC1D23), Antigas (ABC-1234) e Estrangeiras
 * Ilustração Dinâmica do Veículo em Tempo Real
 * Aceite Legal e Conformidade LGPD
 * Seção de FAQ Acordeão e Modais Institucionais
 * Pagamento Exclusivo via PIX Instantâneo (QR Code e Copia e Cola)
 * Taxa Estradapay Fixa: R$ 1,00 por transação unificada
 */

(function () {
  'use strict';

  const state = {
    placaAtual: '',
    debitos: [],
    debitosSelecionadosIds: new Set(),
    taxaFixa: 1.00,
    formaPagamentoSelecionada: 'pix',
    tipoPlacaDetectada: 'neutro', // 'mercosul' | 'antiga' | 'estrangeira' | 'neutro'
    isPlacaEstrangeira: false,
    cobrancaAtiva: null,
    timerInterval: null,
    pollInterval: null,
    segundosRestantes: 900,
    deferredPrompt: null,
  };

  const dom = {
    formConsulta: document.getElementById('formConsulta'),
    inputPlaca: document.getElementById('inputPlaca'),
    plateBox: document.getElementById('plateBox'),
    plateHeaderTitle: document.getElementById('plateHeaderTitle'),
    plateHeaderSubtitle: document.getElementById('plateHeaderSubtitle'),
    plateHeaderFlag: document.getElementById('plateHeaderFlag'),
    plateFlagGraphic: document.getElementById('plateFlagGraphic'),
    plateTypeBadge: document.getElementById('plateTypeBadge'),
    checkPlacaEstrangeira: document.getElementById('checkPlacaEstrangeira'),

    // Ilustração do Veículo SVG
    carPlateTextSvg: document.getElementById('carPlateTextSvg'),
    carPlateHeaderSvg: document.getElementById('carPlateHeaderSvg'),
    carPlateStripe: document.getElementById('carPlateStripe'),
    carPlateBackSvg: document.getElementById('carPlateBackSvg'),
    vehicleLiveStatus: document.getElementById('vehicleLiveStatus'),

    // Aceite Legal e LGPD
    checkLegalTermos: document.getElementById('checkLegalTermos'),
    checkLegalPrivacidade: document.getElementById('checkLegalPrivacidade'),
    consentNoticeText: document.getElementById('consentNoticeText'),
    checkCheckoutConsent: document.getElementById('checkCheckoutConsent'),
    linkOpenTermosModal: document.getElementById('linkOpenTermosModal'),
    linkOpenPrivacidadeModal: document.getElementById('linkOpenPrivacidadeModal'),
    footerLinkTermos: document.getElementById('footerLinkTermos'),
    footerLinkPrivacidade: document.getElementById('footerLinkPrivacidade'),
    modalTermos: document.getElementById('modalTermos'),
    modalPrivacidade: document.getElementById('modalPrivacidade'),
    btnCloseTermosModal: document.getElementById('btnCloseTermosModal'),
    btnAcceptTermosModal: document.getElementById('btnAcceptTermosModal'),
    btnClosePrivacidadeModal: document.getElementById('btnClosePrivacidadeModal'),
    btnAcceptPrivacidadeModal: document.getElementById('btnAcceptPrivacidadeModal'),

    btnConsultar: document.getElementById('btnConsultar'),
    btnText: document.getElementById('btnText'),
    btnSpinner: document.getElementById('btnSpinner'),
    resultsSection: document.getElementById('resultsSection'),
    tollsList: document.getElementById('tollsList'),
    resultsCount: document.getElementById('resultsCount'),
    plateResultBadge: document.getElementById('plateResultBadge'),
    selectAllContainer: document.getElementById('selectAllContainer'),
    selectAllCheckbox: document.getElementById('selectAllCheckbox'),

    // Resumo Fixo Inferior
    checkoutBar: document.getElementById('checkoutBar'),
    summarySubtotal: document.getElementById('summarySubtotal'),
    summaryTaxa: document.getElementById('summaryTaxa'),
    summaryTotal: document.getElementById('summaryTotal'),
    btnPagarPix: document.getElementById('btnPagarPix'),

    // Modal e Elementos de Pagamento PIX
    modalPix: document.getElementById('modalPix'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    tabContentPix: document.getElementById('tabContentPix'),

    // Elementos Pix
    pixTimer: document.getElementById('pixTimer'),
    qrCodeImage: document.getElementById('qrCodeImage'),
    inputPixCode: document.getElementById('inputPixCode'),
    btnCopyPix: document.getElementById('btnCopyPix'),
    btnSimulatePay: document.getElementById('btnSimulatePay'),

    // Telas de Alternância
    pixCheckoutContent: document.getElementById('pixCheckoutContent'),
    pixSuccessContent: document.getElementById('pixSuccessContent'),

    // Comprovante
    receiptPlaca: document.getElementById('receiptPlaca'),
    receiptFormaPagamento: document.getElementById('receiptFormaPagamento'),
    receiptValor: document.getElementById('receiptValor'),
    receiptProtocolo: document.getElementById('receiptProtocolo'),
    receiptAutenticacao: document.getElementById('receiptAutenticacao'),
    receiptData: document.getElementById('receiptData'),
    btnNewSearch: document.getElementById('btnNewSearch'),

    // PWA & Conexão
    btnInstallPwa: document.getElementById('btnInstallPwa'),
    offlineBanner: document.getElementById('offlineBanner'),
    toast: document.getElementById('toast'),
    iosGuideModal: document.getElementById('iosGuideModal'),
    btnCloseIosGuide: document.getElementById('btnCloseIosGuide'),
  };

  function init() {
    registerServiceWorker();
    setupPwaInstall();
    setupNetworkListeners();
    setupEventListeners();
    setupDynamicPlateMask();
    setupForeignPlateToggle();
    setupConsentHandlers();
    setupLegalModals();
    setupFaqAccordion();
    atualizarConsentimento();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => console.log('[Estradapay PWA] Service Worker ativo:', reg.scope))
          .catch((err) => console.warn('[Estradapay PWA] Erro ao registrar SW:', err));
      });
    }
  }

  function setupPwaInstall() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone && dom.btnInstallPwa) {
      dom.btnInstallPwa.style.display = 'none';
      return;
    }

    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredPrompt = e;
      if (dom.btnInstallPwa) dom.btnInstallPwa.style.display = 'inline-flex';
    });

    if (dom.btnInstallPwa) {
      dom.btnInstallPwa.addEventListener('click', async () => {
        if (state.deferredPrompt) {
          state.deferredPrompt.prompt();
          const { outcome } = await state.deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            dom.btnInstallPwa.style.display = 'none';
            showToast('Estradapay instalado com sucesso!');
          }
          state.deferredPrompt = null;
        } else if (isIOS && dom.iosGuideModal) {
          dom.iosGuideModal.style.display = 'flex';
        } else {
          showToast('Use o menu do seu navegador e clique em "Adicionar à Tela de Início".');
        }
      });
    }

    if (dom.btnCloseIosGuide) {
      dom.btnCloseIosGuide.addEventListener('click', () => {
        dom.iosGuideModal.style.display = 'none';
      });
    }
  }

  function setupNetworkListeners() {
    window.addEventListener('offline', () => {
      dom.offlineBanner.style.display = 'block';
    });
    window.addEventListener('online', () => {
      dom.offlineBanner.style.display = 'none';
      showToast('Conexão restabelecida!');
    });
    if (!navigator.onLine) {
      dom.offlineBanner.style.display = 'block';
    }
  }

  /**
   * Sincronização e formatação da placa com pré-visualização do veículo em tempo real
   */
  function setupDynamicPlateMask() {
    dom.inputPlaca.addEventListener('input', (e) => {
      const cursorPosition = e.target.selectionStart;
      let raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

      if (state.isPlacaEstrangeira) {
        // Placa estrangeira (ex: Argentina, Uruguai, Paraguai): entre 4 e 10 caracteres alfanuméricos livres
        raw = raw.substring(0, 10);
        e.target.value = raw;
        atualizarTemaVisualPlaca('estrangeira', raw);
        return;
      }

      // Limita a 7 caracteres alfanuméricos no padrão brasileiro
      raw = raw.substring(0, 7);

      const detection = detectarPadraoPlaca(raw);
      state.tipoPlacaDetectada = detection.tipo;

      let formatted = raw;
      if (detection.tipo === 'antiga' && raw.length >= 4) {
        formatted = `${raw.substring(0, 3)}-${raw.substring(3)}`;
      }

      e.target.value = formatted;
      atualizarTemaVisualPlaca(detection.tipo, raw, formatted);

      // Preserva posição do cursor
      if (cursorPosition && cursorPosition <= formatted.length) {
        e.target.setSelectionRange(cursorPosition, cursorPosition);
      }
    });

    // Chips de exemplo rápido
    document.querySelectorAll('.chip-plate').forEach((btn) => {
      btn.addEventListener('click', () => {
        const placaExemplo = btn.getAttribute('data-placa');
        if (placaExemplo === 'AF123CD') {
          dom.checkPlacaEstrangeira.checked = true;
          alternarModoPlacaEstrangeira(true);
        } else if (dom.checkPlacaEstrangeira.checked) {
          dom.checkPlacaEstrangeira.checked = false;
          alternarModoPlacaEstrangeira(false);
        }

        dom.inputPlaca.value = placaExemplo;
        dom.inputPlaca.dispatchEvent(new Event('input'));
        dom.inputPlaca.focus();
      });
    });
  }

  function detectarPadraoPlaca(raw) {
    if (!raw || raw.length === 0) return { tipo: 'neutro' };

    // Regra Mercosul: LLLNLNN (ex: ABC1D23)
    const regexMercosulCompleto = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
    if (regexMercosulCompleto.test(raw)) return { tipo: 'mercosul', pronto: true };

    // Regra Tradicional / Antiga: LLLNNNN (ex: ABC1234)
    const regexAntigoCompleto = /^[A-Z]{3}[0-9]{4}$/;
    if (regexAntigoCompleto.test(raw)) return { tipo: 'antiga', pronto: true };

    // Heurísticas progressivas enquanto o usuário digita
    if (raw.length >= 5) {
      const quintoChar = raw.charAt(4);
      if (/[A-Z]/.test(quintoChar)) return { tipo: 'mercosul', pronto: false };
      if (/[0-9]/.test(quintoChar)) return { tipo: 'antiga', pronto: false };
    }

    if (raw.length === 4) {
      const quartoChar = raw.charAt(3);
      if (/[0-9]/.test(quartoChar)) return { tipo: 'neutro', pronto: false };
    }

    return { tipo: 'neutro', pronto: false };
  }

  function atualizarTemaVisualPlaca(tipo, raw, formatted = '') {
    const textoExibicao = formatted || raw;

    // Atualiza o SVG do Veículo no Para-choque
    if (dom.carPlateTextSvg) {
      dom.carPlateTextSvg.textContent = textoExibicao || (state.isPlacaEstrangeira ? 'ESTRANGEIRA' : 'DIGITE A PLACA');
    }

    if (tipo === 'estrangeira' || state.isPlacaEstrangeira) {
      dom.plateBox.className = 'mercosul-plate-box theme-mercosul';
      dom.plateHeaderTitle.textContent = 'INTERNACIONAL / MERCOSUL';
      dom.plateHeaderSubtitle.textContent = 'EXT';
      if (dom.carPlateHeaderSvg) dom.carPlateHeaderSvg.textContent = 'MERCOSUL';
      if (dom.carPlateStripe) dom.carPlateStripe.setAttribute('fill', '#0284c7');
      dom.plateTypeBadge.className = 'plate-badge-type badge-mercosul';
      dom.plateTypeBadge.textContent = raw.length === 0 ? 'Placa estrangeira ativada' : `Estrangeira (${raw.length} carac.)`;
      if (dom.vehicleLiveStatus) dom.vehicleLiveStatus.textContent = 'Veículo internacional selecionado';
      return;
    }

    if (tipo === 'mercosul') {
      dom.plateBox.className = 'mercosul-plate-box theme-mercosul';
      dom.plateHeaderTitle.textContent = 'BRASIL / MERCOSUL';
      dom.plateHeaderSubtitle.textContent = 'BRASIL';
      if (dom.carPlateHeaderSvg) dom.carPlateHeaderSvg.textContent = 'BRASIL';
      if (dom.carPlateStripe) dom.carPlateStripe.setAttribute('fill', '#003399');
      dom.plateTypeBadge.className = 'plate-badge-type badge-mercosul';
      dom.plateTypeBadge.textContent = raw.length === 7 ? '✓ Padrão Mercosul (Válido)' : 'Digitando Mercosul...';
      if (dom.vehicleLiveStatus) dom.vehicleLiveStatus.textContent = 'Placa Mercosul identificada';
    } else if (tipo === 'antiga') {
      dom.plateBox.className = 'mercosul-plate-box theme-antiga';
      dom.plateHeaderTitle.textContent = 'BRASIL / TRADICIONAL';
      dom.plateHeaderSubtitle.textContent = 'CINZA';
      if (dom.carPlateHeaderSvg) dom.carPlateHeaderSvg.textContent = 'BRASIL';
      if (dom.carPlateStripe) dom.carPlateStripe.setAttribute('fill', '#475569');
      dom.plateTypeBadge.className = 'plate-badge-type badge-antiga';
      dom.plateTypeBadge.textContent = raw.length === 7 ? '✓ Padrão Antigo (Válido)' : 'Digitando Placa Antiga...';
      if (dom.vehicleLiveStatus) dom.vehicleLiveStatus.textContent = 'Placa Cinza Tradicional identificada';
    } else {
      dom.plateBox.className = 'mercosul-plate-box theme-mercosul';
      dom.plateHeaderTitle.textContent = 'BRASIL / MERCOSUL & ANTIGA';
      dom.plateHeaderSubtitle.textContent = 'BRASIL';
      if (dom.carPlateHeaderSvg) dom.carPlateHeaderSvg.textContent = 'BRASIL';
      if (dom.carPlateStripe) dom.carPlateStripe.setAttribute('fill', '#003399');
      dom.plateTypeBadge.className = 'plate-badge-type badge-neutral';
      dom.plateTypeBadge.textContent = raw.length === 0 ? 'Digite a placa veicular' : `${raw.length}/7 caracteres digitados`;
      if (dom.vehicleLiveStatus) dom.vehicleLiveStatus.textContent = 'Pré-visualização do veículo em tempo real';
    }
  }

  function setupForeignPlateToggle() {
    if (!dom.checkPlacaEstrangeira) return;

    dom.checkPlacaEstrangeira.addEventListener('change', (e) => {
      alternarModoPlacaEstrangeira(e.target.checked);
    });
  }

  function alternarModoPlacaEstrangeira(ativo) {
    state.isPlacaEstrangeira = ativo;

    if (ativo) {
      dom.inputPlaca.placeholder = 'Ex: AF123CD ou ARG456';
      dom.inputPlaca.maxLength = 10;
      showToast('Modo de Placa Estrangeira ativado (Mercosul Internacional / América Latina).');
    } else {
      dom.inputPlaca.placeholder = 'ABC1D23 ou ABC-1234';
      dom.inputPlaca.maxLength = 8;
    }

    // Dispara input para atualizar tema
    dom.inputPlaca.dispatchEvent(new Event('input'));
  }

  /**
   * Gerenciamento de Aceite Legal e LGPD
   */
  function setupConsentHandlers() {
    if (dom.checkLegalTermos) {
      dom.checkLegalTermos.addEventListener('change', atualizarConsentimento);
    }
    if (dom.checkLegalPrivacidade) {
      dom.checkLegalPrivacidade.addEventListener('change', atualizarConsentimento);
    }
    if (dom.checkCheckoutConsent) {
      dom.checkCheckoutConsent.addEventListener('change', () => {
        const podePagar = dom.checkCheckoutConsent.checked;
        if (dom.btnSimulatePay) dom.btnSimulatePay.disabled = !podePagar;
        if (dom.btnSubmitCardPayment) dom.btnSubmitCardPayment.disabled = !podePagar;
      });
    }
  }

  function atualizarConsentimento() {
    const termosAceitos = dom.checkLegalTermos ? dom.checkLegalTermos.checked : true;
    const privacidadeAceita = dom.checkLegalPrivacidade ? dom.checkLegalPrivacidade.checked : true;
    const consentimentoValido = termosAceitos && privacidadeAceita;

    if (dom.btnConsultar) {
      dom.btnConsultar.disabled = !consentimentoValido;
    }
    if (dom.consentNoticeText) {
      dom.consentNoticeText.style.display = consentimentoValido ? 'none' : 'block';
    }
  }

  /**
   * Modais Institucionais (Termos de Uso e Política de Privacidade)
   */
  function setupLegalModals() {
    function abrirModal(modal) {
      if (!modal) return;
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    function fecharModal(modal) {
      if (!modal) return;
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }

    // Modal Termos
    if (dom.linkOpenTermosModal) {
      dom.linkOpenTermosModal.addEventListener('click', (e) => {
        e.preventDefault();
        abrirModal(dom.modalTermos);
      });
    }
    if (dom.footerLinkTermos) {
      dom.footerLinkTermos.addEventListener('click', (e) => {
        e.preventDefault();
        abrirModal(dom.modalTermos);
      });
    }
    if (dom.btnCloseTermosModal) {
      dom.btnCloseTermosModal.addEventListener('click', () => fecharModal(dom.modalTermos));
    }
    if (dom.btnAcceptTermosModal) {
      dom.btnAcceptTermosModal.addEventListener('click', () => {
        if (dom.checkLegalTermos) dom.checkLegalTermos.checked = true;
        fecharModal(dom.modalTermos);
        atualizarConsentimento();
        showToast('Termos de Uso aceitos.');
      });
    }

    // Modal Privacidade
    if (dom.linkOpenPrivacidadeModal) {
      dom.linkOpenPrivacidadeModal.addEventListener('click', (e) => {
        e.preventDefault();
        abrirModal(dom.modalPrivacidade);
      });
    }
    if (dom.footerLinkPrivacidade) {
      dom.footerLinkPrivacidade.addEventListener('click', (e) => {
        e.preventDefault();
        abrirModal(dom.modalPrivacidade);
      });
    }
    if (dom.btnClosePrivacidadeModal) {
      dom.btnClosePrivacidadeModal.addEventListener('click', () => fecharModal(dom.modalPrivacidade));
    }
    if (dom.btnAcceptPrivacidadeModal) {
      dom.btnAcceptPrivacidadeModal.addEventListener('click', () => {
        if (dom.checkLegalPrivacidade) dom.checkLegalPrivacidade.checked = true;
        fecharModal(dom.modalPrivacidade);
        atualizarConsentimento();
        showToast('Política de Privacidade (LGPD) aceita.');
      });
    }

    // Fechar ao clicar fora ou Esc
    [dom.modalTermos, dom.modalPrivacidade].forEach((modal) => {
      if (!modal) return;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) fecharModal(modal);
      });
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        fecharModal(dom.modalTermos);
        fecharModal(dom.modalPrivacidade);
      }
    });
  }

  /**
   * Seção de FAQ (Perguntas Frequentes) Acordeão
   */
  function setupFaqAccordion() {
    const triggers = document.querySelectorAll('.accordion-trigger');
    triggers.forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const item = trigger.closest('.accordion-item');
        if (!item) return;
        const isActive = item.classList.contains('active');

        // Fecha os demais para efeito sanfonado elegante
        document.querySelectorAll('.accordion-item').forEach((i) => {
          if (i !== item) i.classList.remove('active');
        });

        item.classList.toggle('active', !isActive);
      });
    });
  }

  function setupEventListeners() {
    dom.formConsulta.addEventListener('submit', (e) => {
      e.preventDefault();
      consultarDebitos(dom.inputPlaca.value.trim());
    });

    if (dom.selectAllCheckbox) {
      dom.selectAllCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          state.debitos.forEach((d) => state.debitosSelecionadosIds.add(d.id));
        } else {
          state.debitosSelecionadosIds.clear();
        }
        renderizarCards();
        atualizarResumoFinanceiro();
      });
    }

    dom.btnPagarPix.addEventListener('click', () => {
      iniciarCheckout('pix');
    });

    dom.btnCloseModal.addEventListener('click', fecharModalPix);
    dom.modalPix.addEventListener('click', (e) => {
      if (e.target === dom.modalPix) fecharModalPix();
    });

    dom.btnCopyPix.addEventListener('click', copiarChavePix);
    dom.btnSimulatePay.addEventListener('click', simularPagamentoBanco);

    if (dom.btnNewSearch) {
      dom.btnNewSearch.addEventListener('click', () => {
        fecharModalPix();
        dom.inputPlaca.value = '';
        atualizarTemaVisualPlaca('neutro', '');
        dom.resultsSection.style.display = 'none';
        dom.checkoutBar.style.display = 'none';
        dom.inputPlaca.focus();
      });
    }
  }

  /**
   * Taxa Estradapay fixa: R$ 1,00 por transação unificada
   * Fórmula: Total = Valor_Total_Pedagios + 1.00
   */
  function calcularTaxaEstradapay(subtotal) {
    if (!subtotal || subtotal <= 0) return 0;
    return Number(state.taxaFixa.toFixed(2));
  }

  function calcularTotalAtual() {
    const selecionados = state.debitos.filter((d) => state.debitosSelecionadosIds.has(d.id));
    const subtotal = selecionados.reduce((acc, curr) => acc + Number(curr.valorTarifa || 0), 0);
    const taxa = selecionados.length > 0 ? calcularTaxaEstradapay(subtotal) : 0;
    return Number((subtotal + taxa).toFixed(2));
  }

  async function consultarDebitos(placa) {
    // Validação de consentimento LGPD obrigatório
    if ((dom.checkLegalTermos && !dom.checkLegalTermos.checked) || (dom.checkLegalPrivacidade && !dom.checkLegalPrivacidade.checked)) {
      showToast('Você deve ler e aceitar os Termos de Uso e a Política de Privacidade.');
      return;
    }

    const limpa = (placa || '').replace(/[^A-Z0-9]/gi, '');
    const minCarac = state.isPlacaEstrangeira ? 4 : 7;

    if (limpa.length < minCarac) {
      showToast(state.isPlacaEstrangeira
        ? 'Digite ao menos 4 caracteres para a placa estrangeira.'
        : 'Digite uma placa válida com 7 caracteres (ex: ABC1D23 ou ABC-1234).'
      );
      dom.inputPlaca.focus();
      return;
    }

    setLoading(true);

    try {
      const url = `/api/v1/consultar?placa=${encodeURIComponent(limpa)}&estrangeira=${state.isPlacaEstrangeira}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro na consulta.');
      }

      state.placaAtual = data.placa;
      state.debitos = data.debitos || [];
      if (data.resumo?.percentualTaxa !== undefined) state.percentualTaxa = Number(data.resumo.percentualTaxa);
      if (data.resumo?.taxaMinima !== undefined) state.taxaMinima = Number(data.resumo.taxaMinima);
      state.debitosSelecionadosIds = new Set(state.debitos.map((d) => d.id));

      exibirResultados();
    } catch (error) {
      showToast(error.message);
    } finally {
      setLoading(false);
    }
  }

  function setLoading(loading) {
    dom.btnConsultar.disabled = loading;
    dom.btnText.style.display = loading ? 'none' : 'inline';
    dom.btnSpinner.style.display = loading ? 'block' : 'none';
  }

  function exibirResultados() {
    dom.resultsSection.style.display = 'block';
    dom.plateResultBadge.textContent = state.placaAtual;
    dom.resultsCount.textContent = `${state.debitos.length} passagem(ns)`;

    if (state.debitos.length === 0) {
      dom.tollsList.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">🎉</div>
          <h3 style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-bottom: 4px;">Nenhum débito encontrado</h3>
          <p style="font-size: 0.825rem; color: #64748b;">Esta placa está 100% em dia com os pedágios Free Flow!</p>
        </div>
      `;
      dom.checkoutBar.style.display = 'none';
      dom.selectAllContainer.style.display = 'none';
      return;
    }

    dom.selectAllContainer.style.display = 'flex';
    if (dom.selectAllCheckbox) {
      dom.selectAllCheckbox.checked = true;
    }

    renderizarCards();
    atualizarResumoFinanceiro();

    // Rola suavemente até os resultados
    dom.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderizarCards() {
    dom.tollsList.innerHTML = '';

    state.debitos.forEach((debito) => {
      const isSelected = state.debitosSelecionadosIds.has(debito.id);
      const isUrgent = debito.diasRestantes <= 5;

      const card = document.createElement('div');
      card.className = `toll-card ${isSelected ? 'selected' : ''}`;
      card.setAttribute('data-id', debito.id);

      card.innerHTML = `
        <div class="toll-card-top">
          <input 
            type="checkbox" 
            class="toll-checkbox" 
            data-id="${debito.id}"
            ${isSelected ? 'checked' : ''}
          >
          <div class="toll-card-header">
            <span class="toll-concessionaria">${debito.concessionaria}</span>
            <span class="toll-rodovia">${debito.rodovia}</span>
          </div>
          <div class="toll-value-box">
            <span class="toll-value">R$ ${Number(debito.valorTarifa).toFixed(2).replace('.', ',')}</span>
          </div>
        </div>

        <div class="toll-details-grid">
          <div>
            <span style="display:block; color:#94a3b8; font-size:0.65rem; text-transform:uppercase;">Pórtico / Local</span>
            <span style="font-weight:600; color:#1e293b;">${debito.portico}</span>
          </div>
          <div>
            <span style="display:block; color:#94a3b8; font-size:0.65rem; text-transform:uppercase;">Data e Hora</span>
            <span style="font-weight:600; color:#1e293b;">${debito.dataHoraFormatada}</span>
          </div>
          <div>
            <span style="display:block; color:#94a3b8; font-size:0.65rem; text-transform:uppercase;">Sentido</span>
            <span style="font-weight:600; color:#1e293b;">${debito.sentido}</span>
          </div>
          <div>
            <span style="display:block; color:#94a3b8; font-size:0.65rem; text-transform:uppercase;">Origem</span>
            <span style="font-weight:600; color:#2563eb;">${debito.origemFonte || 'Rede Free Flow'}</span>
          </div>
        </div>

        <div class="toll-deadline ${isUrgent ? 'urgent' : ''}">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
            <polyline points="12 6 12 12 16 14" stroke-width="2"/>
          </svg>
          <span>
            Pague até <strong>${debito.dataLimiteFormatada}</strong> (${debito.diasRestantes} dias restantes) para evitar multa de R$ 195,23.
          </span>
        </div>
      `;

      // Evento de clique para marcar/desmarcar
      card.addEventListener('click', (e) => {
        if (e.target.type === 'checkbox') return;
        const chk = card.querySelector('.toll-checkbox');
        chk.checked = !chk.checked;
        alternarSelecaoDebito(debito.id, chk.checked);
      });

      const chk = card.querySelector('.toll-checkbox');
      chk.addEventListener('change', (e) => {
        alternarSelecaoDebito(debito.id, e.target.checked);
      });

      dom.tollsList.appendChild(card);
    });
  }

  function alternarSelecaoDebito(id, selecionado) {
    if (selecionado) {
      state.debitosSelecionadosIds.add(id);
    } else {
      state.debitosSelecionadosIds.delete(id);
    }

    const card = dom.tollsList.querySelector(`.toll-card[data-id="${id}"]`);
    if (card) {
      card.classList.toggle('selected', selecionado);
    }

    if (dom.selectAllCheckbox) {
      dom.selectAllCheckbox.checked = state.debitosSelecionadosIds.size === state.debitos.length;
    }

    atualizarResumoFinanceiro();
  }

  function atualizarResumoFinanceiro() {
    const selecionados = state.debitos.filter((d) => state.debitosSelecionadosIds.has(d.id));
    const qtd = selecionados.length;
    const subtotal = selecionados.reduce((acc, curr) => acc + Number(curr.valorTarifa || 0), 0);
    const taxa = qtd > 0 ? calcularTaxaEstradapay(subtotal) : 0;
    const total = Number((subtotal + taxa).toFixed(2));

    dom.summarySubtotal.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    dom.summaryTaxa.textContent = `R$ ${taxa.toFixed(2).replace('.', ',')}`;
    dom.summaryTotal.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;

    if (qtd > 0) {
      dom.checkoutBar.style.display = 'block';
      dom.btnPagarPix.disabled = false;
      dom.btnPagarPix.innerHTML = `
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Pagar ${qtd} Pedágio(s) via PIX • R$ ${total.toFixed(2).replace('.', ',')}
      `;
    } else {
      dom.checkoutBar.style.display = 'block';
      dom.btnPagarPix.disabled = true;
      dom.btnPagarPix.innerHTML = 'Selecione ao menos 1 pedágio';
    }
  }

  async function iniciarCheckout(formaDePagamento = 'pix', abrirModal = true) {
    const passagensIds = Array.from(state.debitosSelecionadosIds);
    if (passagensIds.length === 0) {
      showToast('Selecione pelo menos uma passagem de pedágio para pagar.');
      return;
    }

    try {
      const response = await fetch('/api/v1/pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placa: state.placaAtual,
          passagensIds,
          formaDePagamento: 'pix',
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao preparar cobrança PIX.');
      }

      state.cobrancaAtiva = data;

      if (data.qrCodeBase64) dom.qrCodeImage.src = data.qrCodeBase64;
      if (data.pixCopiaECola) dom.inputPixCode.value = data.pixCopiaECola;

      if (abrirModal) {
        abrirModalCheckout(data);
      }
    } catch (err) {
      showToast(err.message);
    }
  }

  function abrirModalCheckout(cobranca) {
    dom.pixCheckoutContent.style.display = 'block';
    dom.pixSuccessContent.style.display = 'none';

    dom.btnCopyPix.classList.remove('copied');
    dom.btnCopyPix.innerHTML = 'Copiar PIX';

    state.segundosRestantes = cobranca.tempoLimiteSegundos || 900;
    atualizarDisplayTimer();
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      state.segundosRestantes--;
      atualizarDisplayTimer();
      if (state.segundosRestantes <= 0) {
        clearInterval(state.timerInterval);
        showToast('Tempo limite de pagamento expirado. Gere uma nova cobrança.');
        fecharModalPix();
      }
    }, 1000);

    iniciarPollingStatus(cobranca.txid);
    dom.modalPix.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function fecharModalPix() {
    dom.modalPix.classList.remove('open');
    document.body.style.overflow = '';
    clearInterval(state.timerInterval);
    clearInterval(state.pollInterval);
  }

  function atualizarDisplayTimer() {
    const minutos = Math.floor(state.segundosRestantes / 60);
    const segundos = state.segundosRestantes % 60;
    dom.pixTimer.textContent = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
  }

  async function copiarChavePix() {
    const codigo = dom.inputPixCode.value;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(codigo);
      } else {
        dom.inputPixCode.select();
        document.execCommand('copy');
      }
      dom.btnCopyPix.classList.add('copied');
      dom.btnCopyPix.innerHTML = '✓ Copiado!';
      showToast('Código PIX Copia e Cola copiado com sucesso!');
    } catch {
      showToast('Falha ao copiar automaticamente.');
    }
  }

  function iniciarPollingStatus(txid) {
    clearInterval(state.pollInterval);
    state.pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/status/${txid}`);
        const data = await response.json();
        if (data.success && data.status === 'PAGO') {
          clearInterval(state.pollInterval);
          clearInterval(state.timerInterval);
          exibirSucessoPagamento(data);
        }
      } catch (e) {
        console.warn('Checagem de status:', e);
      }
    }, 3000);
  }

  async function simularPagamentoBanco() {
    if (dom.checkCheckoutConsent && !dom.checkCheckoutConsent.checked) {
      showToast('Por favor, marque a confirmação dos termos para finalizar.');
      return;
    }

    if (!state.cobrancaAtiva?.txid) {
      showToast('Nenhuma cobrança ativa.');
      return;
    }

    dom.btnSimulatePay.disabled = true;
    dom.btnSimulatePay.textContent = 'Processando com o Banco...';

    try {
      const response = await fetch(`/api/v1/webhook/simular-pagamento/${state.cobrancaAtiva.txid}`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao simular quitação.');
      }

      showToast('Pagamento confirmado instantaneamente pelo Banco Central!');
      clearInterval(state.pollInterval);
      clearInterval(state.timerInterval);
      exibirSucessoPagamento(data);
    } catch (e) {
      showToast(e.message);
      dom.btnSimulatePay.disabled = false;
      dom.btnSimulatePay.textContent = '⚡ Simular Pagamento Instantâneo PIX (Demo)';
    }
  }

  function exibirSucessoPagamento(data) {
    dom.pixCheckoutContent.style.display = 'none';
    dom.pixSuccessContent.style.display = 'block';

    const cobranca = state.cobrancaAtiva || {};
    dom.receiptPlaca.textContent = cobranca.placa || state.placaAtual;
    dom.receiptFormaPagamento.textContent = 'PIX Instantâneo (Banco Central)';

    dom.receiptValor.textContent = `R$ ${Number(cobranca.valorTotal || data.valorTotal || 0).toFixed(2).replace('.', ',')}`;
    dom.receiptProtocolo.textContent = data.protocoloBaixa || `PROT-${Math.floor(100000 + Math.random() * 900000)}`;
    dom.receiptAutenticacao.textContent = data.autenticacaoBancaria || `AUT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    dom.receiptData.textContent = new Date().toLocaleString('pt-BR');

    // Remove do estado local os itens que foram quitados
    state.debitos = state.debitos.filter((d) => !state.debitosSelecionadosIds.has(d.id));
    state.debitosSelecionadosIds.clear();

    if (state.debitos.length === 0) {
      dom.checkoutBar.style.display = 'none';
      dom.selectAllContainer.style.display = 'none';
    } else {
      renderizarCards();
      atualizarResumoFinanceiro();
    }
  }

  function showToast(msg) {
    dom.toast.textContent = msg;
    dom.toast.classList.add('show');
    setTimeout(() => {
      dom.toast.classList.remove('show');
    }, 3500);
  }

  // Inicialização no DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
