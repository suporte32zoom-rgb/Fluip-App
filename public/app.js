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

    // Autenticação Opcional & Perfil
    authToken: localStorage.getItem('estradapay_token') || null,
    currentUser: null,
    garagem: [],
    historico: [],
    alertas: { whatsapp: '', email: '', ativo: true, avisarComDias: 5 },

    // Módulo Base Aberta Free Flow (Sem Parar / CC BY 4.0)
    porticosFreeFlow: [],
    porticosUfFiltro: 'TODOS',
    porticosBusca: '',
    porticosCarregados: false,
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

    // Header & Menu Hambúrguer
    btnOpenMenu: document.getElementById('btnOpenMenu'),
    btnHeaderAuth: document.getElementById('btnHeaderAuth'),
    headerUserAvatar: document.getElementById('headerUserAvatar'),
    headerUserName: document.getElementById('headerUserName'),

    // Drawer Lateral
    drawerOverlay: document.getElementById('drawerOverlay'),
    drawerMenu: document.getElementById('drawerMenu'),
    btnCloseMenu: document.getElementById('btnCloseMenu'),
    drawerUserName: document.getElementById('drawerUserName'),
    drawerUserStatus: document.getElementById('drawerUserStatus'),
    drawerUserAvatar: document.getElementById('drawerUserAvatar'),
    drawerAuthBanner: document.getElementById('drawerAuthBanner'),
    btnDrawerAuth: document.getElementById('btnDrawerAuth'),
    btnDrawerAuthText: document.getElementById('btnDrawerAuthText'),
    btnDrawerLogout: document.getElementById('btnDrawerLogout'),
    drawerGaragemCount: document.getElementById('drawerGaragemCount'),

    // Itens de Navegação do Drawer
    navItemConsulta: document.getElementById('navItemConsulta'),
    navItemGaragem: document.getElementById('navItemGaragem'),
    navItemHistorico: document.getElementById('navItemHistorico'),
    navItemAlertas: document.getElementById('navItemAlertas'),
    navItemFreeFlow: document.getElementById('navItemFreeFlow'),
    navItemAuth: document.getElementById('navItemAuth'),
    navItemAuthTitle: document.getElementById('navItemAuthTitle'),
    navItemTermos: document.getElementById('navItemTermos'),
    navItemUpdateApp: document.getElementById('navItemUpdateApp'),
    navItemSuporte: document.getElementById('navItemSuporte'),

    // Modal 1: Autenticação
    modalAuth: document.getElementById('modalAuth'),
    btnCloseAuthModal: document.getElementById('btnCloseAuthModal'),
    btnTabLogin: document.getElementById('btnTabLogin'),
    btnTabRegister: document.getElementById('btnTabRegister'),
    formLogin: document.getElementById('formLogin'),
    loginEmail: document.getElementById('loginEmail'),
    loginPassword: document.getElementById('loginPassword'),
    btnSubmitLogin: document.getElementById('btnSubmitLogin'),
    btnDemoLogin: document.getElementById('btnDemoLogin'),
    formRegister: document.getElementById('formRegister'),
    regName: document.getElementById('regName'),
    regEmail: document.getElementById('regEmail'),
    regPassword: document.getElementById('regPassword'),
    regTelefone: document.getElementById('regTelefone'),
    btnSubmitRegister: document.getElementById('btnSubmitRegister'),

    // Modal 2: Minha Garagem
    modalGaragem: document.getElementById('modalGaragem'),
    btnCloseGaragemModal: document.getElementById('btnCloseGaragemModal'),
    garageList: document.getElementById('garageList'),
    formAddVehicle: document.getElementById('formAddVehicle'),
    inputGaragemPlaca: document.getElementById('inputGaragemPlaca'),
    inputGaragemApelido: document.getElementById('inputGaragemApelido'),
    inputGaragemModelo: document.getElementById('inputGaragemModelo'),

    // Modal 3: Histórico de Comprovantes
    modalHistorico: document.getElementById('modalHistorico'),
    btnCloseHistoricoModal: document.getElementById('btnCloseHistoricoModal'),
    historyList: document.getElementById('historyList'),

    // Modal 4: Alertas de Pedágio
    modalAlertas: document.getElementById('modalAlertas'),
    btnCloseAlertasModal: document.getElementById('btnCloseAlertasModal'),
    formAlertas: document.getElementById('formAlertas'),
    alertWhatsapp: document.getElementById('alertWhatsapp'),
    alertEmail: document.getElementById('alertEmail'),
    alertDias: document.getElementById('alertDias'),

    // Modal 5: Onde tem Free Flow? (Base Aberta Sem Parar / CC BY 4.0)
    modalFreeFlow: document.getElementById('modalFreeFlow'),
    btnCloseFreeFlowModal: document.getElementById('btnCloseFreeFlowModal'),
    btnFreeFlowConsultar: document.getElementById('btnFreeFlowConsultar'),
    freeflowSearchInput: document.getElementById('freeflowSearchInput'),
    freeflowChipsRow: document.getElementById('freeflowChipsRow'),
    freeflowCountNotice: document.getElementById('freeflowCountNotice'),
    freeflowContainer: document.getElementById('freeflowContainer'),

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
    setupGuiaNacional();
    setupDrawerMenu();
    setupAuthHandlers();
    setupGarageHandlers();
    setupHistoryHandlers();
    setupAlertasHandlers();
    setupFreeFlowModal();
    checkAuthSession();
    atualizarConsentimento();
  }

  /**
   * Registro do Service Worker com Rotina de Auto-Update Instantâneo
   * Detecta novos deploys via GitHub/Hostinger e atualiza sem prender caches antigos
   */
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    let refreshing = false;

    // Quando um novo Service Worker assume o controle (após skipWaiting),
    // recarrega a página automaticamente para o usuário ver os novos assets imediatamente!
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      console.log('[Estradapay PWA] Nova versão assumiu o controle. Recarregando aplicativo...');
      showToast('🚀 Nova versão detectada! Atualizando aplicativo...');
      setTimeout(() => {
        window.location.reload();
      }, 700);
    });

    // Ouvir mensagens enviadas pelo Service Worker (ex: SW_ACTIVATED)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_ACTIVATED') {
        console.log('[Estradapay PWA] Service Worker ativado na versão:', event.data.version);
        if (!refreshing && event.data.version) {
          // Se for nova ativação e a página não foi recarregada
          const lastVersion = localStorage.getItem('estradapay_sw_version');
          if (lastVersion && lastVersion !== event.data.version) {
            refreshing = true;
            localStorage.setItem('estradapay_sw_version', event.data.version);
            showToast('Aplicativo atualizado com sucesso!');
            setTimeout(() => window.location.reload(), 500);
          } else {
            localStorage.setItem('estradapay_sw_version', event.data.version);
          }
        }
      }
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[Estradapay PWA] Service Worker registrado com sucesso:', registration.scope);

          // Armazenar a referência no estado para uso posterior
          state.swRegistration = registration;

          // Forçar verificação de nova versão imediatamente após o carregamento
          registration.update().catch(() => {});

          // Se já houver um worker em espera (waiting), força ativação imediata
          if (registration.waiting) {
            console.log('[Estradapay PWA] Worker em espera encontrado. Enviando SKIP_WAITING...');
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          // Monitorar quando um novo Service Worker for detectado pelo navegador
          registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;
            if (!installingWorker) return;

            console.log('[Estradapay PWA] Novo Service Worker sendo baixado...');

            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[Estradapay PWA] Nova versão instalada. Acionando ativação...');
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });

          // Rotina periódica: checar se há novo deploy a cada 45 segundos
          setInterval(() => {
            if (navigator.onLine) {
              registration.update().catch(() => {});
            }
          }, 45000);

          // Checar também assim que o usuário retornar ao app / aba
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && navigator.onLine) {
              registration.update().catch(() => {});
            }
          });

          window.addEventListener('focus', () => {
            if (navigator.onLine) {
              registration.update().catch(() => {});
            }
          });
        })
        .catch((err) => console.warn('[Estradapay PWA] Erro ao registrar SW:', err));
    });
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

  /**
   * Seção 📚 Guia Nacional de Free Flow e Rodovias (Acordeão, Chips e Busca Rápida)
   */
  function setupGuiaNacional() {
    const searchInput = document.getElementById('guiaSearchInput');
    const chipsBar = document.getElementById('guiaChipsBar');
    const items = document.querySelectorAll('#guiaAccordion .guia-item');

    if (!items || items.length === 0) return;

    let activeFilter = 'TODAS';
    let searchQuery = '';

    // 1. Sanfona / Cards Expansíveis (Permite abrir e fechar com transição suave)
    items.forEach((item) => {
      const trigger = item.querySelector('.guia-trigger');
      if (trigger) {
        trigger.addEventListener('click', () => {
          const wasActive = item.classList.contains('active');
          item.classList.toggle('active', !wasActive);
        });
      }
    });

    // Função de filtragem unificada (Chips de Rodovia + Busca por Texto)
    function filtrarGuia() {
      const termo = searchQuery.toLowerCase().trim();

      items.forEach((item) => {
        const tags = (item.getAttribute('data-tags') || '').toUpperCase();
        const textoConteudo = item.textContent.toLowerCase();

        // Filtro por Chip
        const atendeChip =
          activeFilter === 'TODAS' ||
          tags.includes(activeFilter);

        // Filtro por Texto de Busca
        const atendeBusca =
          !termo ||
          tags.toLowerCase().includes(termo) ||
          textoConteudo.includes(termo);

        if (atendeChip && atendeBusca) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    }

    // 2. Chips de Filtro Rápido de Rodovias
    if (chipsBar) {
      chipsBar.addEventListener('click', (e) => {
        const chip = e.target.closest('.guia-chip');
        if (!chip) return;

        activeFilter = chip.getAttribute('data-filter') || 'TODAS';

        chipsBar.querySelectorAll('.guia-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');

        filtrarGuia();
      });
    }

    // 3. Campo de Busca Instantânea
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        filtrarGuia();
      });
    }
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

    // Registrar o comprovante no histórico (conta ou local)
    registrarComprovanteNoHistorico({
      txid: cobranca.txid || `TXID-${Date.now()}`,
      placa: cobranca.placa || state.placaAtual,
      valorTotal: Number(cobranca.valorTotal || data.valorTotal || 0),
      subtotal: Number(cobranca.resumo?.subtotal || (Number(cobranca.valorTotal || data.valorTotal || 1) - 1.00)),
      taxa: 1.00,
      protocolo: data.protocoloBaixa || `PROT-${Math.floor(100000 + Math.random() * 900000)}`,
      autenticacao: data.autenticacaoBancaria || `AUT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      concessionaria: state.debitos[0]?.concessionaria || 'Rede Free Flow Nacional',
      formaDePagamento: 'PIX Instantâneo',
      dataHora: new Date().toLocaleString('pt-BR'),
    });
  }

  /* ========================================================
     MENU HAMBÚRGUER E DRAWER LATERAL
     ======================================================== */
  function setupDrawerMenu() {
    if (dom.btnOpenMenu) {
      dom.btnOpenMenu.addEventListener('click', openDrawer);
    }
    if (dom.btnCloseMenu) {
      dom.btnCloseMenu.addEventListener('click', closeDrawer);
    }
    if (dom.drawerOverlay) {
      dom.drawerOverlay.addEventListener('click', closeDrawer);
    }

    // Itens de navegação da gaveta
    if (dom.navItemConsulta) {
      dom.navItemConsulta.addEventListener('click', () => {
        closeDrawer();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (dom.inputPlaca) dom.inputPlaca.focus();
      });
    }

    if (dom.navItemGaragem) {
      dom.navItemGaragem.addEventListener('click', () => {
        closeDrawer();
        openModal(dom.modalGaragem);
        renderGaragem();
      });
    }

    if (dom.navItemHistorico) {
      dom.navItemHistorico.addEventListener('click', () => {
        closeDrawer();
        openModal(dom.modalHistorico);
        renderHistorico();
      });
    }

    if (dom.navItemAlertas) {
      dom.navItemAlertas.addEventListener('click', () => {
        closeDrawer();
        openModal(dom.modalAlertas);
        carregarCamposAlertas();
      });
    }

    if (dom.navItemFreeFlow) {
      dom.navItemFreeFlow.addEventListener('click', () => {
        closeDrawer();
        openModal(dom.modalFreeFlow);
        carregarPorticosFreeFlow();
      });
    }

    if (dom.navItemAuth) {
      dom.navItemAuth.addEventListener('click', () => {
        closeDrawer();
        if (state.currentUser) {
          openModal(dom.modalGaragem);
          renderGaragem();
        } else {
          openModal(dom.modalAuth);
        }
      });
    }

    if (dom.btnHeaderAuth) {
      dom.btnHeaderAuth.addEventListener('click', () => {
        if (state.currentUser) {
          openDrawer();
        } else {
          openModal(dom.modalAuth);
        }
      });
    }

    if (dom.btnDrawerAuth) {
      dom.btnDrawerAuth.addEventListener('click', () => {
        closeDrawer();
        openModal(dom.modalAuth);
      });
    }

    if (dom.btnDrawerLogout) {
      dom.btnDrawerLogout.addEventListener('click', logoutUser);
    }

    if (dom.navItemTermos) {
      dom.navItemTermos.addEventListener('click', () => {
        closeDrawer();
        if (dom.modalTermos) dom.modalTermos.style.display = 'flex';
      });
    }

    if (dom.navItemUpdateApp) {
      dom.navItemUpdateApp.addEventListener('click', () => {
        closeDrawer();
        forcarAtualizacaoPwa();
      });
    }

    // Botões de fechar modais específicos
    if (dom.btnCloseAuthModal) dom.btnCloseAuthModal.addEventListener('click', () => closeModal(dom.modalAuth));
    if (dom.btnCloseGaragemModal) dom.btnCloseGaragemModal.addEventListener('click', () => closeModal(dom.modalGaragem));
    if (dom.btnCloseHistoricoModal) dom.btnCloseHistoricoModal.addEventListener('click', () => closeModal(dom.modalHistorico));
    if (dom.btnCloseAlertasModal) dom.btnCloseAlertasModal.addEventListener('click', () => closeModal(dom.modalAlertas));
    if (dom.btnCloseFreeFlowModal) dom.btnCloseFreeFlowModal.addEventListener('click', () => closeModal(dom.modalFreeFlow));

    // Fechar ao clicar no backdrop dos modais de recursos
    [dom.modalAuth, dom.modalGaragem, dom.modalHistorico, dom.modalAlertas, dom.modalFreeFlow].forEach((modal) => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) closeModal(modal);
        });
      }
    });
  }

  function openDrawer() {
    if (dom.drawerMenu && dom.drawerOverlay) {
      dom.drawerOverlay.classList.add('open');
      dom.drawerMenu.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeDrawer() {
    if (dom.drawerMenu && dom.drawerOverlay) {
      dom.drawerOverlay.classList.remove('open');
      dom.drawerMenu.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  function openModal(modal) {
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(modal) {
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  /* ========================================================
     SISTEMA DE AUTENTICAÇÃO OPCIONAL (JWT)
     ======================================================== */
  function setupAuthHandlers() {
    if (dom.btnTabLogin && dom.btnTabRegister) {
      dom.btnTabLogin.addEventListener('click', () => {
        dom.btnTabLogin.classList.add('active');
        dom.btnTabRegister.classList.remove('active');
        dom.formLogin.style.display = 'flex';
        dom.formRegister.style.display = 'none';
      });

      dom.btnTabRegister.addEventListener('click', () => {
        dom.btnTabRegister.classList.add('active');
        dom.btnTabLogin.classList.remove('active');
        dom.formRegister.style.display = 'flex';
        dom.formLogin.style.display = 'none';
      });
    }

    if (dom.formLogin) {
      dom.formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = dom.loginEmail.value.trim();
        const password = dom.loginPassword.value;

        if (!email || !password) {
          showToast('Preencha e-mail e senha.');
          return;
        }

        try {
          dom.btnSubmitLogin.disabled = true;
          dom.btnSubmitLogin.textContent = 'Entrando...';

          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Falha ao autenticar.');
          }

          setSessionData(data.token, data.user);
          showToast(`Bem-vindo, ${data.user.name}!`);
          closeModal(dom.modalAuth);
        } catch (err) {
          showToast(err.message);
        } finally {
          dom.btnSubmitLogin.disabled = false;
          dom.btnSubmitLogin.textContent = 'Entrar na Minha Conta';
        }
      });
    }

    if (dom.btnDemoLogin) {
      dom.btnDemoLogin.addEventListener('click', () => {
        dom.loginEmail.value = 'demo@estradapay.com.br';
        dom.loginPassword.value = 'demo123';
        dom.formLogin.dispatchEvent(new Event('submit'));
      });
    }

    if (dom.formRegister) {
      dom.formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = dom.regName.value.trim();
        const email = dom.regEmail.value.trim();
        const password = dom.regPassword.value;
        const telefone = dom.regTelefone.value.trim();

        if (!name || !email || !password) {
          showToast('Preencha todos os campos obrigatórios.');
          return;
        }

        if (password.length < 6) {
          showToast('A senha deve ter no mínimo 6 caracteres.');
          return;
        }

        try {
          dom.btnSubmitRegister.disabled = true;
          dom.btnSubmitRegister.textContent = 'Criando conta...';

          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, telefone }),
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Falha ao criar conta.');
          }

          setSessionData(data.token, data.user);
          showToast(`Conta criada com sucesso! Olá, ${data.user.name}.`);
          closeModal(dom.modalAuth);
        } catch (err) {
          showToast(err.message);
        } finally {
          dom.btnSubmitRegister.disabled = false;
          dom.btnSubmitRegister.textContent = 'Criar Minha Conta Grátis';
        }
      });
    }
  }

  function setSessionData(token, user) {
    state.authToken = token;
    state.currentUser = user;
    state.garagem = user.garagem || [];
    state.historico = user.historico || [];
    state.alertas = user.alertas || state.alertas;

    localStorage.setItem('estradapay_token', token);
    localStorage.setItem('estradapay_user', JSON.stringify(user));

    updateUserInterface();
  }

  async function checkAuthSession() {
    const savedToken = localStorage.getItem('estradapay_token');
    if (!savedToken) {
      carregarDadosLocaisGuest();
      updateUserInterface();
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        state.authToken = savedToken;
        state.currentUser = data.user;
        state.garagem = data.user.garagem || [];
        state.historico = data.user.historico || [];
        state.alertas = data.user.alertas || state.alertas;
      } else {
        localStorage.removeItem('estradapay_token');
        localStorage.removeItem('estradapay_user');
        carregarDadosLocaisGuest();
      }
    } catch {
      carregarDadosLocaisGuest();
    }

    updateUserInterface();
  }

  function carregarDadosLocaisGuest() {
    try {
      const guestGaragem = JSON.parse(localStorage.getItem('estradapay_guest_garage') || '[]');
      const guestHistorico = JSON.parse(localStorage.getItem('estradapay_guest_history') || '[]');
      const guestAlertas = JSON.parse(localStorage.getItem('estradapay_guest_alerts') || 'null');

      state.garagem = guestGaragem.length > 0 ? guestGaragem : [
        { id: 'guest_g1', placa: 'ABC1D23', apelido: 'Meu Carro', modelo: 'Passeio', tipo: 'mercosul', adicionadoEm: new Date().toISOString() }
      ];
      state.historico = guestHistorico;
      if (guestAlertas) state.alertas = guestAlertas;
    } catch {
      state.garagem = [];
      state.historico = [];
    }
  }

  function logoutUser() {
    state.authToken = null;
    state.currentUser = null;
    localStorage.removeItem('estradapay_token');
    localStorage.removeItem('estradapay_user');

    carregarDadosLocaisGuest();
    updateUserInterface();
    closeDrawer();
    showToast('Você saiu da sua conta.');
  }

  function updateUserInterface() {
    if (state.currentUser) {
      const primeiroNome = state.currentUser.name.split(' ')[0];
      const inicial = (state.currentUser.name[0] || 'U').toUpperCase();

      if (dom.headerUserName) dom.headerUserName.textContent = primeiroNome;
      if (dom.headerUserAvatar) dom.headerUserAvatar.textContent = inicial;

      if (dom.drawerUserName) dom.drawerUserName.textContent = state.currentUser.name;
      if (dom.drawerUserStatus) dom.drawerUserStatus.textContent = state.currentUser.email;
      if (dom.drawerUserAvatar) dom.drawerUserAvatar.textContent = inicial;

      if (dom.btnDrawerAuth) dom.btnDrawerAuth.style.display = 'none';
      if (dom.btnDrawerLogout) dom.btnDrawerLogout.style.display = 'flex';
      if (dom.navItemAuthTitle) dom.navItemAuthTitle.textContent = `Minha Conta (${primeiroNome})`;
    } else {
      if (dom.headerUserName) dom.headerUserName.textContent = 'Entrar';
      if (dom.headerUserAvatar) {
        dom.headerUserAvatar.innerHTML = `
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        `;
      }

      if (dom.drawerUserName) dom.drawerUserName.textContent = 'Modo Visitante';
      if (dom.drawerUserStatus) dom.drawerUserStatus.textContent = 'Consulta & Pix liberados sem login';
      if (dom.drawerUserAvatar) {
        dom.drawerUserAvatar.innerHTML = `
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        `;
      }

      if (dom.btnDrawerAuth) dom.btnDrawerAuth.style.display = 'flex';
      if (dom.btnDrawerLogout) dom.btnDrawerLogout.style.display = 'none';
      if (dom.navItemAuthTitle) dom.navItemAuthTitle.textContent = 'Entrar / Criar Conta';
    }

    if (dom.drawerGaragemCount) {
      dom.drawerGaragemCount.textContent = String(state.garagem.length);
    }
  }

  /* ========================================================
     MINHA GARAGEM (VEÍCULOS SALVOS)
     ======================================================== */
  function setupGarageHandlers() {
    if (dom.formAddVehicle) {
      dom.formAddVehicle.addEventListener('submit', async (e) => {
        e.preventDefault();
        const placa = dom.inputGaragemPlaca.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const apelido = dom.inputGaragemApelido.value.trim();
        const modelo = dom.inputGaragemModelo.value.trim();

        if (placa.length < 4 || placa.length > 8) {
          showToast('Digite uma placa válida.');
          return;
        }

        if (state.garagem.some((v) => v.placa === placa)) {
          showToast(`A placa ${placa} já está salva na sua garagem.`);
          return;
        }

        if (state.authToken) {
          try {
            const res = await fetch('/api/auth/garagem', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${state.authToken}`,
              },
              body: JSON.stringify({ placa, apelido, modelo }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao salvar.');

            state.garagem = data.garagem;
            showToast(`Veículo ${placa} adicionado à sua Garagem!`);
          } catch (err) {
            showToast(err.message);
            return;
          }
        } else {
          // Salva no armazenamento local do visitante
          const novo = {
            id: `guest_gar_${Date.now()}`,
            placa,
            apelido: apelido || `Veículo ${placa}`,
            modelo: modelo || 'Automóvel Passeio',
            tipo: /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa) ? 'mercosul' : 'antiga',
            adicionadoEm: new Date().toISOString(),
          };
          state.garagem.push(novo);
          localStorage.setItem('estradapay_guest_garage', JSON.stringify(state.garagem));
          showToast(`Veículo ${placa} salvo na Garagem!`);
        }

        dom.inputGaragemPlaca.value = '';
        dom.inputGaragemApelido.value = '';
        dom.inputGaragemModelo.value = '';
        renderGaragem();
        updateUserInterface();
      });
    }
  }

  function renderGaragem() {
    if (!dom.garageList) return;

    if (state.garagem.length === 0) {
      dom.garageList.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">🚘</span>
          <strong style="color: var(--dark); font-size: 0.875rem;">Nenhum veículo salvo</strong>
          <small>Adicione sua placa abaixo para consultar débitos com 1 clique.</small>
        </div>
      `;
      return;
    }

    dom.garageList.innerHTML = state.garagem.map((veiculo) => {
      const isMercosul = veiculo.tipo === 'mercosul' || /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(veiculo.placa);
      const placaFormatada = isMercosul && veiculo.placa.length === 7
        ? `${veiculo.placa.substring(0, 3)}${veiculo.placa[3]}${veiculo.placa[4]}${veiculo.placa.substring(5)}`
        : veiculo.placa;

      return `
        <div class="garage-card" data-placa="${veiculo.placa}" data-id="${veiculo.id}">
          <div class="garage-plate-badge">
            <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:${isMercosul ? '#2563eb' : '#64748b'};"></span>
            ${placaFormatada}
          </div>
          <div class="garage-card-info">
            <span class="garage-card-apelido">${veiculo.apelido || 'Veículo ' + veiculo.placa}</span>
            <span class="garage-card-modelo">${veiculo.modelo || 'Automóvel Passeio'}</span>
          </div>
          <div class="garage-card-actions">
            <button type="button" class="btn-garage-search" data-action="consultar" data-placa="${veiculo.placa}" title="Consultar débitos">
              🔍 Consultar
            </button>
            <button type="button" class="btn-garage-remove" data-action="remover" data-placa="${veiculo.placa}" data-id="${veiculo.id}" title="Remover da garagem">
              ✕
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Adiciona ouvintes para os botões da lista
    dom.garageList.querySelectorAll('button[data-action="consultar"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const placa = btn.getAttribute('data-placa');
        closeModal(dom.modalGaragem);
        if (dom.inputPlaca) {
          dom.inputPlaca.value = placa;
          atualizarTemaVisualPlaca(
            /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa) ? 'mercosul' : 'antiga',
            placa
          );
          consultarDebitos(placa);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });

    dom.garageList.querySelectorAll('button[data-action="remover"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const placa = btn.getAttribute('data-placa');
        const id = btn.getAttribute('data-id');

        if (state.authToken) {
          try {
            const res = await fetch(`/api/auth/garagem/${id || placa}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${state.authToken}` },
            });
            const data = await res.json();
            if (res.ok && data.success) {
              state.garagem = data.garagem;
            }
          } catch {
            state.garagem = state.garagem.filter((v) => v.placa !== placa && v.id !== id);
          }
        } else {
          state.garagem = state.garagem.filter((v) => v.placa !== placa && v.id !== id);
          localStorage.setItem('estradapay_guest_garage', JSON.stringify(state.garagem));
        }

        renderGaragem();
        updateUserInterface();
        showToast(`Veículo ${placa} removido da garagem.`);
      });
    });
  }

  /* ========================================================
     HISTÓRICO DE COMPROVANTES
     ======================================================== */
  function setupHistoryHandlers() {
    // Inicialização da lista
  }

  function renderHistorico() {
    if (!dom.historyList) return;

    if (state.historico.length === 0) {
      dom.historyList.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">📄</span>
          <strong style="color: var(--dark); font-size: 0.875rem;">Nenhum comprovante emitido</strong>
          <small>Assim que você pagar um pedágio via Pix, seu recibo oficial ficará registrado aqui.</small>
        </div>
      `;
      return;
    }

    dom.historyList.innerHTML = state.historico.map((comp) => {
      return `
        <div class="history-card">
          <div class="history-card-header">
            <div>
              <span class="garage-plate-badge" style="font-size: 0.8rem; padding: 2px 6px;">${comp.placa}</span>
              <span class="history-fee-pill" style="margin-left: 6px;">Taxa: R$ 1,00</span>
            </div>
            <span class="history-card-status">✓ PAGO (PIX)</span>
          </div>

          <div class="history-row">
            <span>Concessionária:</span>
            <strong>${comp.concessionaria || 'Rede Free Flow'}</strong>
          </div>

          <div class="history-row">
            <span>Data e Horário:</span>
            <span>${comp.dataHora}</span>
          </div>

          <div class="history-row">
            <span>Total Pago (Tarifas + Taxa):</span>
            <strong style="color: #059669; font-size: 0.9rem;">R$ ${Number(comp.valorTotal).toFixed(2).replace('.', ',')}</strong>
          </div>

          <div class="history-row">
            <span>Protocolo Concessionária:</span>
            <code style="font-family: monospace; font-size: 0.75rem;">${comp.protocolo}</code>
          </div>

          <div class="history-row" style="border-top: 1px dashed var(--slate-200); padding-top: 6px;">
            <span>Autenticação Bancária:</span>
            <code style="font-family: monospace; font-size: 0.7rem; color: #64748b;">${comp.autenticacao}</code>
          </div>
        </div>
      `;
    }).join('');
  }

  async function registrarComprovanteNoHistorico(comp) {
    state.historico.unshift(comp);

    if (state.authToken) {
      try {
        await fetch('/api/auth/historico', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.authToken}`,
          },
          body: JSON.stringify(comp),
        });
      } catch (err) {
        console.warn('Erro ao sincronizar comprovante na nuvem:', err);
      }
    } else {
      localStorage.setItem('estradapay_guest_history', JSON.stringify(state.historico));
    }
  }

  /* ========================================================
     ALERTAS DE PEDÁGIO
     ======================================================== */
  function setupAlertasHandlers() {
    if (dom.formAlertas) {
      dom.formAlertas.addEventListener('submit', async (e) => {
        e.preventDefault();
        const whatsapp = dom.alertWhatsapp.value.trim();
        const email = dom.alertEmail.value.trim();
        const dias = Number(dom.alertDias.value) || 5;

        if (!whatsapp && !email) {
          showToast('Preencha ao menos WhatsApp ou E-mail para receber alertas.');
          return;
        }

        state.alertas = {
          whatsapp,
          email,
          ativo: true,
          avisarComDias: dias,
        };

        if (state.authToken) {
          try {
            const res = await fetch('/api/auth/alertas', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${state.authToken}`,
              },
              body: JSON.stringify(state.alertas),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error);
          } catch (err) {
            console.warn('Erro ao salvar alertas na nuvem:', err);
          }
        } else {
          localStorage.setItem('estradapay_guest_alerts', JSON.stringify(state.alertas));
        }

        showToast('Alertas ativados com sucesso! Você receberá lembretes automáticos no WhatsApp.');
        closeModal(dom.modalAlertas);
      });
    }
  }

  function carregarCamposAlertas() {
    if (dom.alertWhatsapp && state.alertas?.whatsapp) {
      dom.alertWhatsapp.value = state.alertas.whatsapp;
    } else if (dom.alertWhatsapp && state.currentUser?.telefone) {
      dom.alertWhatsapp.value = state.currentUser.telefone;
    }

    if (dom.alertEmail && state.alertas?.email) {
      dom.alertEmail.value = state.alertas.email;
    } else if (dom.alertEmail && state.currentUser?.email) {
      dom.alertEmail.value = state.currentUser.email;
    }

    if (dom.alertDias && state.alertas?.avisarComDias) {
      dom.alertDias.value = String(state.alertas.avisarComDias);
    }
  }

  // Catálogo completo oficial embutido de contingência (Garante exibição instantânea 0ms)
  const PORTICOS_BACKUP_CATALOG = [
    {
      id: 'portico_dutra_01',
      concessionaria: 'CCR RioSP',
      rodovia: 'BR-116 (Via Dutra - Trecho Metropolitano SP)',
      km: 'Km 204 a 231',
      municipio: 'Arujá / Guarulhos / SP',
      uf: 'SP',
      sentido: 'Bidirecional (SP / Rio)',
      tarifaBase: 4.10,
      prazoPagamentoDias: 30,
      status: 'ATIVO',
      tipoVia: 'Rodovia Federal Concedida',
      localizacaoDescricao: '21 pontos de cobrança Free Flow na chegada à Marginal Tietê, Arujá e Rodoanel',
      coordenadas: { lat: -23.4472, lng: -46.4715 },
    },
    {
      id: 'portico_dutra_02',
      concessionaria: 'CCR RioSP',
      rodovia: 'BR-116 (Via Dutra - Vale do Paraíba)',
      km: 'Km 140',
      municipio: 'São José dos Campos',
      uf: 'SP',
      sentido: 'Bidirecional',
      tarifaBase: 7.40,
      prazoPagamentoDias: 30,
      status: 'ATIVO',
      tipoVia: 'Rodovia Federal Concedida',
      localizacaoDescricao: 'Pórtico eletrônico no polo industrial e aeroespacial de São José dos Campos',
      coordenadas: { lat: -23.1896, lng: -45.8841 },
    },
    {
      id: 'portico_riosp_01',
      concessionaria: 'CCR RioSP',
      rodovia: 'BR-101 (Rio-Santos - Costa Verde)',
      km: 'Km 538,5',
      municipio: 'Paraty',
      uf: 'RJ',
      sentido: 'Bidirecional (Norte / Sul)',
      tarifaBase: 4.80,
      prazoPagamentoDias: 30,
      status: 'ATIVO',
      tipoVia: 'Rodovia Federal',
      localizacaoDescricao: 'Próximo ao trevo de acesso histórico a Paraty',
      coordenadas: { lat: -23.2201, lng: -44.7174 },
    },
    {
      id: 'portico_riosp_02',
      concessionaria: 'CCR RioSP',
      rodovia: 'BR-101 (Rio-Santos - Costa Verde)',
      km: 'Km 447,3',
      municipio: 'Mangaratiba',
      uf: 'RJ',
      sentido: 'Bidirecional (Norte / Sul)',
      tarifaBase: 4.80,
      prazoPagamentoDias: 30,
      status: 'ATIVO',
      tipoVia: 'Rodovia Federal',
      localizacaoDescricao: 'Trecho da Costa Verde entre Conceição de Jacareí e Mangaratiba',
      coordenadas: { lat: -22.9602, lng: -44.0416 },
    },
    {
      id: 'portico_riosp_03',
      concessionaria: 'CCR RioSP',
      rodovia: 'BR-101 (Rio-Santos - Costa Verde)',
      km: 'Km 414,9',
      municipio: 'Itaguaí',
      uf: 'RJ',
      sentido: 'Bidirecional (Norte / Sul)',
      tarifaBase: 4.80,
      prazoPagamentoDias: 30,
      status: 'ATIVO',
      tipoVia: 'Rodovia Federal',
      localizacaoDescricao: 'Acesso metropolitano ao Porto de Itaguaí e Baixada Fluminense',
      coordenadas: { lat: -22.8872, lng: -43.7758 },
    },
    {
      id: 'portico_tamoios_01',
      concessionaria: 'Concessionária Tamoios',
      rodovia: 'SP-099 (Contorno Sul Caraguatatuba - São Sebastião)',
      km: 'Km 13+500',
      municipio: 'Caraguatatuba',
      uf: 'SP',
      sentido: 'Bidirecional (Litoral Norte)',
      tarifaBase: 5.20,
      prazoPagamentoDias: 30,
      status: 'ATIVO',
      tipoVia: 'Rodovia Estadual',
      localizacaoDescricao: 'Pórtico eletrônico do novo Contorno da Serra do Mar ligando Caraguatatuba a São Sebastião',
      coordenadas: { lat: -23.6229, lng: -45.4128 },
    },
    {
      id: 'portico_imigrantes_01',
      concessionaria: 'Ecovias dos Imigrantes',
      rodovia: 'SP-160 (Rodovia dos Imigrantes - SAI)',
      km: 'Km 29 e Km 38',
      municipio: 'São Bernardo do Campo',
      uf: 'SP',
      sentido: 'Descida e Subida da Serra',
      tarifaBase: 35.80,
      prazoPagamentoDias: 30,
      status: 'ATIVO',
      tipoVia: 'Rodovia Estadual Concedida',
      localizacaoDescricao: 'Pórticos eletrônicos no topo da Serra do Mar e acesso à Baixada Santista',
      coordenadas: { lat: -23.7712, lng: -46.5647 },
    },
    {
      id: 'portico_csg_01',
      concessionaria: 'Caminhos da Serra Gaúcha (CSG)',
      rodovia: 'ERS-122',
      km: 'Km 99 e Km 108',
      municipio: 'Flores da Cunha / Antônio Prado',
      uf: 'RS',
      sentido: 'Serra / Capital',
      tarifaBase: 8.60,
      prazoPagamentoDias: 30,
      status: 'ATIVO',
      tipoVia: 'Rodovia Estadual',
      localizacaoDescricao: 'Pórticos de integração da Serra Gaúcha e travessia do Rio das Antas',
      coordenadas: { lat: -29.0289, lng: -51.1895 },
    },
    {
      id: 'portico_csg_02',
      concessionaria: 'Caminhos da Serra Gaúcha (CSG)',
      rodovia: 'ERS-240 / ERS-446',
      km: 'Km 22 e Km 6',
      municipio: 'Portão / Carlos Barbosa',
      uf: 'RS',
      sentido: 'Vale do Sinos / Serra Gaúcha',
      tarifaBase: 9.00,
      prazoPagamentoDias: 30,
      status: 'ATIVO',
      tipoVia: 'Rodovia Estadual',
      localizacaoDescricao: 'Elo metropolitano e acesso à região dos vinhedos da Serra Gaúcha',
      coordenadas: { lat: -29.7011, lng: -51.2423 },
    },
    {
      id: 'portico_econoroeste_01',
      concessionaria: 'Ecovias Noroeste Paulista',
      rodovia: 'SP-333 (Rodovia Laurentino Mascari)',
      km: 'Km 179 e Km 110',
      municipio: 'Itápolis / Jaboticabal',
      uf: 'SP',
      sentido: 'Interior / Capital',
      tarifaBase: 8.90,
      prazoPagamentoDias: 30,
      status: 'ATIVO',
      tipoVia: 'Rodovia Estadual',
      localizacaoDescricao: 'Primeiros pórticos Free Flow do interior paulista substituindo praças físicas',
      coordenadas: { lat: -21.5956, lng: -48.8142 },
    },
    {
      id: 'portico_cnl_01',
      concessionaria: 'Concessionária Novo Litoral (CNL)',
      rodovia: 'SP-055 / SP-088 (Mogi-Dutra)',
      km: 'Km 236 a 291 e Km 37',
      municipio: 'Santos / Cubatão / Arujá',
      uf: 'SP',
      sentido: 'Litoral Paulista / Capital',
      tarifaBase: 8.50,
      prazoPagamentoDias: 30,
      status: 'ATIVO',
      tipoVia: 'Rodovia Estadual',
      localizacaoDescricao: 'Malha rodoviária 100% eletrônica da Baixada Santista e Mogi das Cruzes',
      coordenadas: { lat: -23.8953, lng: -46.4251 },
    },
    {
      id: 'portico_rodoanel_01',
      concessionaria: 'Via SP Serra (Rodoanel Norte SPE)',
      rodovia: 'SP-021 (Rodoanel Mário Covas)',
      km: 'Km 135',
      municipio: 'Guarulhos',
      uf: 'SP',
      sentido: 'Ambos os sentidos',
      tarifaBase: 5.50,
      prazoPagamentoDias: 30,
      status: 'ATIVO',
      tipoVia: 'Rodovia Estadual Concedida',
      localizacaoDescricao: 'Pórtico eletrônico do Programa Siga Fácil no anel viário metropolitano de SP',
      coordenadas: { lat: -23.4118, lng: -46.5295 },
    },
    {
      id: 'portico_raposo_01',
      concessionaria: 'Motiva Sorocabana (CCR Sorocabana)',
      rodovia: 'SP-270 (Rodovia Raposo Tavares)',
      km: 'Km 48 e Km 83',
      municipio: 'São Roque / Alumínio',
      uf: 'SP',
      sentido: 'Capital / Interior',
      tarifaBase: 5.90,
      prazoPagamentoDias: 30,
      status: 'ATIVO',
      tipoVia: 'Rodovia Estadual Concedida',
      localizacaoDescricao: 'Pórticos eletrônicos no corredor Raposo Tavares',
      coordenadas: { lat: -23.5312, lng: -47.1354 },
    },
    {
      id: 'portico_epr_triangulo_01',
      concessionaria: 'EPR Triângulo / Sul de Minas',
      rodovia: 'BR-452 / BR-459',
      km: 'Km 186 e Km 127',
      municipio: 'Uberlândia / Santa Rita do Sapucaí',
      uf: 'MG',
      sentido: 'Triângulo e Sul Mineiro',
      tarifaBase: 11.20,
      prazoPagamentoDias: 30,
      status: 'ATIVO',
      tipoVia: 'Rodovia Federal Concedida',
      localizacaoDescricao: 'Pórticos eletrônicos em rodovias federais e estaduais de Minas Gerais',
      coordenadas: { lat: -19.0125, lng: -47.9863 },
    },
  ];

  /* ========================================================
     ONDE TEM FREE FLOW? (BASE ABERTA SEM PARAR / GITHUB)
     ======================================================== */
  function setupFreeFlowModal() {
    // Inicialização Imediata com dados do backup: nunca trava o usuário em tela de carregamento
    if (!state.porticosFreeFlow || state.porticosFreeFlow.length === 0) {
      state.porticosFreeFlow = [...PORTICOS_BACKUP_CATALOG];
      state.porticosCarregados = true;
    }

    if (dom.btnFreeFlowConsultar) {
      dom.btnFreeFlowConsultar.addEventListener('click', () => {
        closeModal(dom.modalFreeFlow);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (dom.inputPlaca) dom.inputPlaca.focus();
      });
    }

    // Filtro por Estado (Pills / Chips)
    if (dom.freeflowChipsRow) {
      dom.freeflowChipsRow.addEventListener('click', (e) => {
        const chip = e.target.closest('.freeflow-chip');
        if (!chip) return;
        const uf = chip.getAttribute('data-uf') || 'TODOS';
        state.porticosUfFiltro = uf;

        // Atualizar classe ativa
        dom.freeflowChipsRow.querySelectorAll('.freeflow-chip').forEach((c) => {
          c.classList.remove('active');
        });
        chip.classList.add('active');

        renderPorticosList();
      });
    }

    // Busca por Texto (Rodovia, Município, Concessionária)
    if (dom.freeflowSearchInput) {
      dom.freeflowSearchInput.addEventListener('input', (e) => {
        state.porticosBusca = (e.target.value || '').trim();
        renderPorticosList();
      });
    }

    // Renderizar imediatamente no carregamento da aplicação
    renderPorticosList();

    // Sincronizar em segundo plano de forma silenciosa e resiliente
    carregarPorticosFreeFlow();
  }

  /**
   * Carregamento assíncrono com exibição imediata do backup e atualização resiliente (Timeout 1.5s)
   */
  async function carregarPorticosFreeFlow(forcar = false) {
    // 1. GARANTIA INSTANTÂNEA: Se o estado estiver vazio, aplicar o backup imediatamente
    if (!state.porticosFreeFlow || state.porticosFreeFlow.length === 0) {
      state.porticosFreeFlow = [...PORTICOS_BACKUP_CATALOG];
      state.porticosCarregados = true;
      renderPorticosList();
    } else {
      renderPorticosList();
    }

    // 2. Tentar carregar em segundo plano o arquivo estático público public/data/porticos.json
    fetch('/data/porticos.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.porticos) && data.porticos.length > 0) {
          state.porticosFreeFlow = data.porticos;
          renderPorticosList();
        }
      })
      .catch(() => {});

    // 3. Atualizar em segundo plano via rota /api/freeflow conectada ao GitHub (com timeout de 1.5s)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const response = await fetch('/api/freeflow', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.porticos) && data.porticos.length > 0) {
          state.porticosFreeFlow = data.porticos;
          state.porticosCarregados = true;
          renderPorticosList();
        }
      }
    } catch (err) {
      // Falha de rede ou timeout de 1.5s: lista do backup local já está ativa na tela
      console.log('[FreeFlow PWA] Mantendo catálogo de contingência rápida do backup');
    }
  }

  function renderPorticosList() {
    if (!dom.freeflowContainer) return;

    let lista = [...state.porticosFreeFlow];

    // Filtro por Estado
    if (state.porticosUfFiltro && state.porticosUfFiltro !== 'TODOS') {
      const ufUpper = state.porticosUfFiltro.toUpperCase();
      lista = lista.filter((p) => (p.uf || '').toUpperCase() === ufUpper);
    }

    // Filtro por Busca
    if (state.porticosBusca) {
      const q = state.porticosBusca.toLowerCase();
      lista = lista.filter((p) =>
        (p.rodovia && p.rodovia.toLowerCase().includes(q)) ||
        (p.concessionaria && p.concessionaria.toLowerCase().includes(q)) ||
        (p.municipio && p.municipio.toLowerCase().includes(q)) ||
        (p.km && p.km.toLowerCase().includes(q))
      );
    }

    // Atualizar contador
    if (dom.freeflowCountNotice) {
      const ufTexto = state.porticosUfFiltro === 'TODOS' ? 'no Brasil' : `em ${state.porticosUfFiltro}`;
      dom.freeflowCountNotice.textContent = `Exibindo ${lista.length} pórtico(s) ${ufTexto}`;
    }

    if (lista.length === 0) {
      dom.freeflowContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <span style="font-weight: 700; color: #1e293b;">Nenhum pórtico encontrado</span>
          <span style="font-size: 0.75rem; color: #64748b;">Tente buscar por outro termo ou selecione "Todos os Estados".</span>
          <button type="button" class="btn-secondary" id="btnLimparFiltrosFreeflow" style="padding: 6px 14px; font-size: 0.75rem; margin-top: 8px;">
            Limpar Filtros
          </button>
        </div>
      `;
      const btnLimpar = document.getElementById('btnLimparFiltrosFreeflow');
      if (btnLimpar) {
        btnLimpar.addEventListener('click', () => {
          state.porticosUfFiltro = 'TODOS';
          state.porticosBusca = '';
          if (dom.freeflowSearchInput) dom.freeflowSearchInput.value = '';
          if (dom.freeflowChipsRow) {
            dom.freeflowChipsRow.querySelectorAll('.freeflow-chip').forEach((c) => {
              if (c.getAttribute('data-uf') === 'TODOS') c.classList.add('active');
              else c.classList.remove('active');
            });
          }
          renderPorticosList();
        });
      }
      return;
    }

    dom.freeflowContainer.innerHTML = lista.map((p) => {
      const tarifaFormatada = Number(p.tarifaBase || 0).toFixed(2).replace('.', ',');
      const mapLink = p.coordenadas && p.coordenadas.lat
        ? `https://www.google.com/maps/search/?api=1&query=${p.coordenadas.lat},${p.coordenadas.lng}`
        : null;

      return `
        <div class="freeflow-card" data-uf="${p.uf || 'BR'}">
          <div class="freeflow-header">
            <div class="freeflow-road-group">
              <span class="freeflow-road">${p.rodovia}</span>
              <span class="freeflow-km-badge">${p.km}</span>
            </div>
            <div class="freeflow-badges">
              <span class="freeflow-state-badge">${p.uf || 'BR'}</span>
              <span class="freeflow-status-badge">🟢 ATIVO</span>
            </div>
          </div>

          <div class="freeflow-concessionaria">
            🏢 <strong>${p.concessionaria}</strong>
          </div>

          <div class="freeflow-locations">
            📍 <strong>${p.municipio} - ${p.uf}</strong> • ${p.localizacaoDescricao || 'Pórtico eletrônico com leitura automática de placas e tags'}
          </div>

          <div class="freeflow-meta-grid">
            <div class="freeflow-meta-item">
              <span class="freeflow-meta-label">Tarifa Oficial Base</span>
              <span class="freeflow-meta-val highlight">R$ ${tarifaFormatada}</span>
            </div>
            <div class="freeflow-meta-item">
              <span class="freeflow-meta-label">Prazo Legal Sem Multa</span>
              <span class="freeflow-meta-val">⏱️ ${p.prazoPagamentoDias || 30} dias (Art. 209-A)</span>
            </div>
          </div>

          <div class="freeflow-card-footer">
            ${mapLink ? `
              <a href="${mapLink}" target="_blank" rel="noopener noreferrer" class="freeflow-map-link">
                📍 Ver no mapa
              </a>
            ` : `<span></span>`}
            <button type="button" class="freeflow-action-btn" data-rodovia="${p.rodovia || ''}">
              🚗 Consultar Débitos
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Adicionar eventos aos botões "Consultar Débitos" de cada pórtico
    dom.freeflowContainer.querySelectorAll('.freeflow-action-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rodovia = btn.getAttribute('data-rodovia') || '';
        closeModal(dom.modalFreeFlow);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (dom.inputPlaca) {
          dom.inputPlaca.focus();
          showToast(`🚗 Informe sua placa para consultar débitos de ${rodovia}`);
        }
      });
    });
  }

  /* ========================================================
     ROTINA MANUAL / AUTOMÁTICA DE ATUALIZAÇÃO E LIMPEZA
     ======================================================== */
  async function forcarAtualizacaoPwa() {
    showToast('Buscando atualizações e limpando caches...');
    try {
      // 1. Limpar caches do navegador
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((k) => caches.delete(k)));
        console.log('[Estradapay PWA] Todos os caches locais foram limpos.');
      }

      // 2. Avisar o Service Worker para expirar e buscar novo bundle
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          if (reg.active) {
            reg.active.postMessage({ type: 'CLEAR_ALL_CACHES' });
          }
          await reg.update().catch(() => {});
        }
      }

      showToast('Aplicativo atualizado com sucesso! Recarregando...');
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (err) {
      console.warn('Erro ao forçar atualização:', err);
      window.location.reload();
    }
  }

  // Expor no window para debug e chamadas externas se necessário
  window.forcarAtualizacaoPwa = forcarAtualizacaoPwa;

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
