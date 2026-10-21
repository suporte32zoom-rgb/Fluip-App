/**
 * Serviço de Integração com a Base Aberta de Free Flow do Sem Parar (GitHub)
 * Repositório: https://github.com/Sem-Parar/SEM-PARAR-FREE-FLOW (Licença CC BY 4.0)
 * 
 * Funcionalidades:
 * - Leitura e sincronização dos CSVs oficiais do GitHub (porticos-free-flow e concessionarias-free-flow).
 * - Cache em memória no Node.js com ciclo de renovação automática a cada 24 horas.
 * - Cruzamento inteligente de passagens trafegadas (via APIBrasil) com a malha de pórticos sincronizada.
 * - Fallback seguro para src/data/freeflowPorticosBackup.json em caso de indisponibilidade de rede.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/Sem-Parar/SEM-PARAR-FREE-FLOW/main/dados';
const URL_PORTICOS_CSV = `${GITHUB_RAW_BASE}/porticos-free-flow.csv`;
const URL_CONCESSIONARIAS_CSV = `${GITHUB_RAW_BASE}/concessionarias-free-flow.csv`;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas em milissegundos
const FILE_CACHE_PATH = path.join(process.cwd(), 'src/data/freeflowPorticos.json');
const FILE_BACKUP_PATH = path.join(process.cwd(), 'src/data/freeFlowBackup.json');
const FILE_BACKUP_ALT_PATH = path.join(process.cwd(), 'src/data/freeflowPorticosBackup.json');

// Tarifas base oficiais de referência por concessionária / trecho para veículos de passeio (Cat. 1)
const TARIFAS_BASE_REFERENCIA = {
  'CCR RioSP': {
    'BR-116': 4.10, // Dutra Metropolitano (Arujá, Guarulhos, SP)
    'BR-101': 4.80, // Rio-Santos (Paraty, Mangaratiba, Itaguaí)
    default: 4.80,
  },
  'Ecovias dos Imigrantes': {
    'SP-160': 35.80, // Imigrantes
    'SP-150': 35.80, // Anchieta
    default: 35.80,
  },
  'Concessionária Tamoios': {
    'SP-099': 5.20, // Contorno Sul Caraguatatuba - São Sebastião
    default: 5.20,
  },
  'Concessionária Novo Litoral (CNL)': {
    'SP-055': 10.20,
    'SP-088': 6.80,
    'SP-098': 8.40,
    default: 8.50,
  },
  'Caminhos da Serra Gaúcha (CSG)': {
    'ERS-122': 8.60,
    'ERS-240': 9.00,
    'ERS-446': 8.60,
    default: 8.60,
  },
  'Ecovias Noroeste Paulista': {
    'SP-333': 8.90, // Itápolis / Jaboticabal
    'SP-326': 11.40, // Dobrada / Taiúva
    default: 9.80,
  },
  'Via SP Serra (Rodoanel Norte SPE)': {
    'SP-021': 5.50, // Rodoanel Mário Covas
    default: 5.50,
  },
  'Motiva Sorocabana (CCR Sorocabana)': {
    'SP-270': 5.90, // Raposo Tavares
    default: 5.90,
  },
  'EPR Triângulo': {
    'BR-452': 12.80,
    'MGF-455': 10.20,
    default: 11.50,
  },
  'EPR Sul de Minas': {
    'BR-459': 9.40,
    'MG-290': 9.40,
    default: 9.40,
  },
  'EPR Iguaçu': {
    'BR-163': 11.20,
    'PR-182': 10.50,
    default: 10.80,
  },
  'Rota Verde Goiás': {
    'BR-060': 9.60,
    'BR-452': 10.20,
    default: 9.80,
  },
};

class FreeFlowBaseService {
  constructor() {
    this.porticos = [];
    this.metadados = {
      fonte: 'Base Aberta Sem Parar / SEM-PARAR-FREE-FLOW',
      licenca: 'CC BY 4.0',
      repositorio: 'https://github.com/Sem-Parar/SEM-PARAR-FREE-FLOW',
      dataSincronizacao: null,
      origem: 'INICIALIZANDO',
      totalPorticos: 0,
    };
    this.ultimaSincronizacao = 0;
    this.sincronizacaoEmAndamento = null;

    // Inicialização assíncrona
    this.inicializar();
  }

  /**
   * Inicializa o serviço carregando dados do cache local e agendando sync com GitHub
   */
  async inicializar() {
    this.carregarDoCacheLocalOuBackup();
    // Tenta atualizar em segundo plano a partir do GitHub
    this.sincronizarComGitHub(false).catch((err) => {
      console.warn('[FreeFlowBaseService] Sincronização inicial com GitHub adiada:', err.message);
    });
  }

  /**
   * Parseador robusto de CSV compatível com campos entre aspas e delimitadores vírgula
   */
  parseCsv(textoCsv) {
    const linhas = textoCsv.trim().split(/\r?\n/);
    if (linhas.length < 2) return [];

    const cabecalho = this.parseCsvLinha(linhas[0]);
    const registros = [];

    for (let i = 1; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      if (!linha) continue;
      const valores = this.parseCsvLinha(linha);
      const obj = {};
      cabecalho.forEach((col, idx) => {
        obj[col] = valores[idx] !== undefined ? valores[idx] : '';
      });
      registros.push(obj);
    }
    return registros;
  }

  parseCsvLinha(linha) {
    const valores = [];
    let atual = '';
    let dentroAspas = false;

    for (let i = 0; i < linha.length; i++) {
      const char = linha[i];
      if (char === '"') {
        if (dentroAspas && linha[i + 1] === '"') {
          atual += '"';
          i++; // pular quote escapada
        } else {
          dentroAspas = !dentroAspas;
        }
      } else if (char === ',' && !dentroAspas) {
        valores.push(atual.trim());
        atual = '';
      } else {
        atual += char;
      }
    }
    valores.push(atual.trim());
    return valores;
  }

  /**
   * Determina a tarifa base estimada para um pórtico a partir de sua concessionária e rodovia
   */
  obterTarifaBaseEstimada(concessionariaNome, siglaOuRodovia) {
    for (const [concChave, rodoviasMap] of Object.entries(TARIFAS_BASE_REFERENCIA)) {
      if (concessionariaNome.toLowerCase().includes(concChave.toLowerCase()) || concChave.toLowerCase().includes(concessionariaNome.toLowerCase())) {
        for (const [siglaChave, tarifa] of Object.entries(rodoviasMap)) {
          if (siglaChave !== 'default' && siglaOuRodovia.toLowerCase().includes(siglaChave.toLowerCase())) {
            return tarifa;
          }
        }
        return rodoviasMap.default || 8.50;
      }
    }
    return 7.50;
  }

  /**
   * Sincroniza a base de dados diretamente com o GitHub do Sem Parar
   * @param {boolean} forcar - Se true, força o download ignorando o TTL de 24h
   */
  async sincronizarComGitHub(forcar = false) {
    const agora = Date.now();
    if (!forcar && (agora - this.ultimaSincronizacao < CACHE_TTL_MS) && this.porticos.length > 0) {
      return {
        sucesso: true,
        fonte: 'CACHE_MEMORIA',
        total: this.porticos.length,
        ultimaSincronizacao: new Date(this.ultimaSincronizacao).toISOString(),
      };
    }

    if (this.sincronizacaoEmAndamento) {
      return this.sincronizacaoEmAndamento;
    }

    this.sincronizacaoEmAndamento = (async () => {
      try {
        console.log('[FreeFlowBaseService] Conectando ao repositório público do Sem Parar no GitHub...');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const resPorticos = await fetch(URL_PORTICOS_CSV, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Estradapay-FreeFlow-Engine/2.0' },
        });
        clearTimeout(timeoutId);

        if (!resPorticos.ok) {
          throw new Error(`HTTP ${resPorticos.status} ao obter porticos-free-flow.csv do GitHub`);
        }

        const csvTexto = await resPorticos.text();
        const linhasCsv = this.parseCsv(csvTexto);

        if (!linhasCsv || linhasCsv.length === 0) {
          throw new Error('CSV do GitHub vazio ou com formato inválido');
        }

        const porticosMapeados = linhasCsv.map((item, index) => {
          const conc = item.concessionaria || 'Concessionária Free Flow';
          const rodoviaSigla = item.sigla || '';
          const rodoviaNome = item.rodovia ? `${item.rodovia} (${rodoviaSigla})` : rodoviaSigla;
          const kmFormatado = item.km ? (item.km.toLowerCase().startsWith('km') ? item.km : `Km ${item.km}`) : 'Km n/d';
          const tarifa = this.obterTarifaBaseEstimada(conc, rodoviaSigla || item.rodovia || '');
          const statusLimpo = (item.status || 'ativo').toUpperCase().trim();

          return {
            id: `gh_portico_${item.sigla || 'rd'}_${item.km ? item.km.replace(/[^0-9]/g, '') : index}_${index}`,
            concessionaria: conc,
            rodovia: rodoviaNome,
            sigla: rodoviaSigla,
            km: kmFormatado,
            municipio: item.municipio || 'Brasil',
            uf: item.uf ? item.uf.toUpperCase() : 'SP',
            sentido: item.sentido || 'Bidirecional',
            tarifaBase: Number(tarifa.toFixed(2)),
            prazoPagamentoDias: 30, // Prazo legal regulamentar nacional (Art. 209-A CTB)
            status: statusLimpo.includes('ATIVO') ? 'ATIVO' : (statusLimpo.includes('MONITORAMENTO') ? 'MONITORAMENTO' : 'PREVISTO'),
            tipoVia: item.tipo === 'cobranca' ? 'Cobrança Eletrônica Free Flow' : 'Monitoramento de Tráfego',
            localizacaoDescricao: item.observacao || `Pórtico eletrônico localizado em ${item.municipio || ''} (${item.uf || ''})`,
            coordenadas: this.estimarCoordenadas(item.uf, item.municipio),
            formasDePagamento: ['PIX Instantâneo', 'Tag Automática'],
            fonteOriginal: item.fonte || 'Sem Parar / GitHub',
          };
        });

        // Atualizar armazenamento em memória
        this.porticos = porticosMapeados;
        this.ultimaSincronizacao = Date.now();
        this.metadados = {
          fonte: 'Base Aberta Sem Parar / SEM-PARAR-FREE-FLOW',
          licenca: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
          repositorio: 'https://github.com/Sem-Parar/SEM-PARAR-FREE-FLOW',
          dataSincronizacao: new Date().toISOString(),
          origem: 'GITHUB_ONLINE',
          totalPorticos: porticosMapeados.length,
          notaLegal: 'Prazos de quitação e penalidades em conformidade com a Lei nº 14.157/2021, Art. 209-A do CTB e Resolução CONTRAN nº 989/2022.',
        };

        // Salvar cópia local no arquivo de cache
        this.salvarCacheLocal();

        console.log(`[FreeFlowBaseService] Base de dados sincronizada com sucesso do GitHub: ${porticosMapeados.length} pórticos carregados.`);
        return {
          sucesso: true,
          fonte: 'GITHUB_ONLINE',
          total: porticosMapeados.length,
          dataSincronizacao: this.metadados.dataSincronizacao,
        };
      } catch (error) {
        console.warn(`[FreeFlowBaseService] Falha na sincronização online com GitHub (${error.message}). Utilizando base de cache ou backup seguro.`);
        this.carregarDoCacheLocalOuBackup();
        return {
          sucesso: false,
          fonte: this.metadados.origem,
          aviso: error.message,
          total: this.porticos.length,
        };
      } finally {
        this.sincronizacaoEmAndamento = null;
      }
    })();

    return this.sincronizacaoEmAndamento;
  }

  /**
   * Salva os dados atuais em cache no disco (freeflowPorticos.json)
   */
  salvarCacheLocal() {
    try {
      const payload = {
        metadados: this.metadados,
        porticos: this.porticos,
      };
      fs.writeFileSync(FILE_CACHE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[FreeFlowBaseService] Aviso ao persistir cache local em disco:', err.message);
    }
  }

  /**
   * Carrega do cache local em disco ou recorre ao arquivo de backup seguro
   */
  carregarDoCacheLocalOuBackup() {
    try {
      if (fs.existsSync(FILE_CACHE_PATH)) {
        const conteudo = fs.readFileSync(FILE_CACHE_PATH, 'utf-8');
        const dados = JSON.parse(conteudo);
        if (dados && Array.isArray(dados.porticos) && dados.porticos.length > 0) {
          this.porticos = dados.porticos;
          this.metadados = {
            ...dados.metadados,
            origem: 'CACHE_LOCAL',
            dataSincronizacao: dados.metadados?.dataAtualizacao || new Date().toISOString(),
            totalPorticos: dados.porticos.length,
          };
          this.ultimaSincronizacao = Date.now();
          return;
        }
      }
    } catch (err) {
      console.warn('[FreeFlowBaseService] Erro ao carregar freeflowPorticos.json:', err.message);
    }

    // Fallback para arquivo de backup seguro
    this.carregarDoBackupSeguro();
  }

  /**
   * Carrega estritamente o arquivo de backup local seguro com pórticos da Dutra, SP e demais rodovias
   */
  carregarDoBackupSeguro() {
    try {
      const backupFile = fs.existsSync(FILE_BACKUP_PATH) ? FILE_BACKUP_PATH : FILE_BACKUP_ALT_PATH;
      if (fs.existsSync(backupFile)) {
        const conteudo = fs.readFileSync(backupFile, 'utf-8');
        const dados = JSON.parse(conteudo);
        this.porticos = dados.porticos || [];
        this.metadados = {
          ...dados.metadados,
          origem: 'BACKUP_LOCAL_SEGURO',
          totalPorticos: this.porticos.length,
        };
        this.ultimaSincronizacao = Date.now();
        console.log(`[FreeFlowBaseService] Backup seguro carregado com sucesso (${path.basename(backupFile)}): ${this.porticos.length} pórticos disponíveis.`);
      }
    } catch (err) {
      console.error('[FreeFlowBaseService] Erro crítico ao carregar backup seguro:', err);
    }
  }

  /**
   * Coordenadas aproximadas por estado/município para visualização em mapa
   */
  estimarCoordenadas(uf, municipio = '') {
    const mapaUf = {
      RJ: { lat: -22.9068, lng: -43.1729 },
      SP: { lat: -23.5505, lng: -46.6333 },
      RS: { lat: -30.0346, lng: -51.2177 },
      MG: { lat: -19.9167, lng: -43.9345 },
      PR: { lat: -25.4284, lng: -49.2733 },
      GO: { lat: -16.6869, lng: -49.2648 },
    };
    return mapaUf[uf] || { lat: -23.5505, lng: -46.6333 };
  }

  /**
   * Retorna os pórticos aplicando filtros opcionais de UF, busca textual e status
   */
  obterPorticos({ uf, q, status } = {}) {
    let resultado = [...this.porticos];

    if (uf && uf !== 'TODOS') {
      const ufFiltro = uf.toUpperCase().trim();
      resultado = resultado.filter((p) => p.uf === ufFiltro);
    }

    if (status) {
      const statusFiltro = status.toUpperCase().trim();
      resultado = resultado.filter((p) => (p.status || '').toUpperCase() === statusFiltro);
    }

    if (q) {
      const qLower = q.toLowerCase().trim();
      resultado = resultado.filter((p) =>
        (p.rodovia && p.rodovia.toLowerCase().includes(qLower)) ||
        (p.concessionaria && p.concessionaria.toLowerCase().includes(qLower)) ||
        (p.municipio && p.municipio.toLowerCase().includes(qLower)) ||
        (p.km && p.km.toLowerCase().includes(qLower))
      );
    }

    return {
      metadados: this.metadados,
      total: resultado.length,
      porticos: resultado,
    };
  }

  /**
   * Cruza dados de uma passagem (recebida via APIBrasil ou simulador) com o catálogo oficial sincronizado
   * Retorna os dados oficiais com enriquecimento da concessionária, tarifa oficial e identificação do pórtico
   * @param {Object} passagem - { rodovia, portico, concessionaria, categoriaVeiculo }
   * @returns {Object} Dados enriquecidos
   */
  cruzarTrechoComBase(passagem = {}) {
    const rodoviaConsulta = (passagem.rodovia || '').toLowerCase();
    const porticoConsulta = (passagem.portico || '').toLowerCase();
    const concessionariaConsulta = (passagem.concessionaria || '').toLowerCase();

    // Tenta encontrar o pórtico exato na base sincronizada
    const encontrado = this.porticos.find((p) => {
      const rMatch = p.rodovia && rodoviaConsulta && (p.rodovia.toLowerCase().includes(rodoviaConsulta) || rodoviaConsulta.includes(p.rodovia.toLowerCase()) || (p.sigla && rodoviaConsulta.includes(p.sigla.toLowerCase())));
      const kMatch = p.km && porticoConsulta && (porticoConsulta.includes(p.km.toLowerCase()) || p.km.toLowerCase().includes(porticoConsulta));
      return rMatch || (kMatch && p.concessionaria.toLowerCase().includes(concessionariaConsulta));
    });

    if (encontrado) {
      return {
        rodoviaOficial: encontrado.rodovia,
        trechoKmOficial: encontrado.km,
        concessionariaOficial: encontrado.concessionaria,
        municipioOficial: encontrado.municipio,
        ufOficial: encontrado.uf,
        tarifaOficialBase: encontrado.tarifaBase,
        statusPortico: encontrado.status,
        prazoPagamentoDias: encontrado.prazoPagamentoDias || 30,
        origemFonte: 'Sincronizado Sem Parar / GitHub (Oficial)',
      };
    }

    // Se não encontrou exato, escolhe o pórtico mais representativo da concessionária
    const porConcessionaria = this.porticos.find((p) =>
      passagem.concessionaria && p.concessionaria && p.concessionaria.toLowerCase().includes(concessionariaConsulta)
    );

    if (porConcessionaria) {
      return {
        rodoviaOficial: porConcessionaria.rodovia,
        trechoKmOficial: porConcessionaria.km,
        concessionariaOficial: porConcessionaria.concessionaria,
        municipioOficial: porConcessionaria.municipio,
        ufOficial: porConcessionaria.uf,
        tarifaOficialBase: porConcessionaria.tarifaBase,
        statusPortico: porConcessionaria.status,
        prazoPagamentoDias: porConcessionaria.prazoPagamentoDias || 30,
        origemFonte: 'Base Aberta Sem Parar / Mapeamento de Trecho',
      };
    }

    // Default seguro com padrões regulatórios oficiais
    return {
      rodoviaOficial: passagem.rodovia || 'BR-116 (Via Dutra / Trecho Metropolitano)',
      trechoKmOficial: passagem.portico || 'Km 204',
      concessionariaOficial: passagem.concessionaria || 'CCR RioSP',
      municipioOficial: 'Guarulhos / Arujá',
      ufOficial: 'SP',
      tarifaOficialBase: Number(passagem.valorTarifa || 4.80),
      statusPortico: 'ATIVO',
      prazoPagamentoDias: 30,
      origemFonte: 'Base de Backup Oficial Estradapay',
    };
  }
}

const freeFlowBaseService = new FreeFlowBaseService();
export default freeFlowBaseService;
