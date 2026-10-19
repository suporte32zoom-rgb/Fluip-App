import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'estradapay_jwt_secret_key_2026';
const JWT_EXPIRES_IN = '7d';

// Banco de dados em memória para gerenciamento opcional de usuários
const usersDatabase = new Map();

// Usuário de demonstração pré-carregado
const seedDemoUser = () => {
  const demoEmail = 'demo@estradapay.com.br';
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('demo123', salt);

  usersDatabase.set(demoEmail, {
    id: 'user_demo_001',
    name: 'Carlos Silva (Demo)',
    email: demoEmail,
    telefone: '(11) 98765-4321',
    passwordHash,
    garagem: [
      {
        id: 'gar_1',
        placa: 'ABC1D23',
        apelido: 'SUV de Viagem',
        modelo: 'Jeep Compass',
        tipo: 'mercosul',
        adicionadoEm: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
      {
        id: 'gar_2',
        placa: 'BRA2E19',
        apelido: 'Carro da Família',
        modelo: 'Toyota Corolla',
        tipo: 'mercosul',
        adicionadoEm: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
    ],
    historico: [
      {
        id: 'hist_demo_1',
        txid: 'TXID-DEMO-982144',
        placa: 'BRA2E19',
        valorTotal: 15.80,
        subtotal: 14.80,
        taxa: 1.00,
        dataHora: '14/10/2026, 15:42',
        protocolo: 'PROT-892144',
        autenticacao: 'AUT-PIX-B39F8A',
        status: 'PAGO',
        concessionaria: 'CCR RioSP (BR-101)',
        formaDePagamento: 'PIX Instantâneo',
      },
    ],
    alertas: {
      whatsapp: '(11) 98765-4321',
      email: demoEmail,
      ativo: true,
      avisarComDias: 5,
    },
    createdAt: new Date().toISOString(),
  });
};

seedDemoUser();

/**
 * Utilitário: Gerar token JWT
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Utilitário: Sanitizar objeto de usuário para resposta segura
 */
const sanitizeUser = (user) => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    telefone: user.telefone || '',
    garagem: user.garagem || [],
    historico: user.historico || [],
    alertas: user.alertas || { whatsapp: '', email: '', ativo: false },
    createdAt: user.createdAt,
  };
};

/**
 * Middleware para autenticação opcional ou obrigatória via Bearer Token
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token de autenticação não fornecido.',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Localizar usuário pelo e-mail
    const user = Array.from(usersDatabase.values()).find((u) => u.id === decoded.id || u.email === decoded.email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Sessão inválida ou usuário não encontrado.',
      });
    }

    req.user = user;
    next();
  } catch {
    return res.status(403).json({
      success: false,
      error: 'Token inválido ou expirado. Faça login novamente.',
    });
  }
};

/**
 * Controller de Autenticação e Gestão de Perfil Opcional
 */
export const authController = {
  /**
   * POST /api/auth/register
   * Cadastro opcional de novo usuário
   */
  async register(req, res) {
    try {
      const { name, email, password, telefone } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'O nome é obrigatório e deve ter ao menos 2 caracteres.',
        });
      }

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({
          success: false,
          error: 'E-mail válido é obrigatório.',
        });
      }

      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'A senha é obrigatória e deve ter pelo menos 6 caracteres.',
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (usersDatabase.has(normalizedEmail)) {
        return res.status(409).json({
          success: false,
          error: 'Este e-mail já está cadastrado. Faça login ou use outro e-mail.',
        });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const newUser = {
        id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: name.trim(),
        email: normalizedEmail,
        telefone: (telefone || '').trim(),
        passwordHash,
        garagem: [],
        historico: [],
        alertas: {
          whatsapp: (telefone || '').trim(),
          email: normalizedEmail,
          ativo: true,
          avisarComDias: 5,
        },
        createdAt: new Date().toISOString(),
      };

      usersDatabase.set(normalizedEmail, newUser);

      const token = generateToken(newUser);

      return res.status(201).json({
        success: true,
        message: 'Cadastro realizado com sucesso! Bem-vindo ao Estradapay.',
        token,
        user: sanitizeUser(newUser),
      });
    } catch (error) {
      console.error('[AuthController.register] Erro:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao criar conta.',
      });
    }
  },

  /**
   * POST /api/auth/login
   * Login do usuário
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'E-mail e senha são obrigatórios.',
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const user = usersDatabase.get(normalizedEmail);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'E-mail ou senha incorretos.',
        });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: 'E-mail ou senha incorretos.',
        });
      }

      const token = generateToken(user);

      return res.status(200).json({
        success: true,
        message: 'Login realizado com sucesso!',
        token,
        user: sanitizeUser(user),
      });
    } catch (error) {
      console.error('[AuthController.login] Erro:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao realizar login.',
      });
    }
  },

  /**
   * GET /api/auth/me
   * Retorna os dados do usuário autenticado
   */
  async me(req, res) {
    return res.status(200).json({
      success: true,
      user: sanitizeUser(req.user),
    });
  },

  /**
   * GET /api/auth/garagem
   * Lista as placas salvas na garagem do usuário
   */
  async getGaragem(req, res) {
    return res.status(200).json({
      success: true,
      garagem: req.user.garagem || [],
    });
  },

  /**
   * POST /api/auth/garagem
   * Salva uma nova placa na garagem do usuário
   */
  async addGaragem(req, res) {
    try {
      const { placa, apelido, modelo } = req.body;

      if (!placa || typeof placa !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'A placa do veículo é obrigatória.',
        });
      }

      const limpaPlaca = placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (limpaPlaca.length < 4 || limpaPlaca.length > 8) {
        return res.status(400).json({
          success: false,
          error: 'Placa veicular inválida.',
        });
      }

      if (!req.user.garagem) {
        req.user.garagem = [];
      }

      // Verificar se a placa já está na garagem
      const jaExiste = req.user.garagem.some((g) => g.placa === limpaPlaca);
      if (jaExiste) {
        return res.status(400).json({
          success: false,
          error: `O veículo com placa ${limpaPlaca} já está salvo na sua Garagem.`,
        });
      }

      const isMercosul = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i.test(limpaPlaca);

      const novoItem = {
        id: `gar_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        placa: limpaPlaca,
        apelido: (apelido || '').trim() || `Veículo ${limpaPlaca}`,
        modelo: (modelo || '').trim() || 'Automóvel Passeio',
        tipo: isMercosul ? 'mercosul' : 'antiga',
        adicionadoEm: new Date().toISOString(),
      };

      req.user.garagem.push(novoItem);

      return res.status(201).json({
        success: true,
        message: `Veículo ${limpaPlaca} adicionado à sua garagem com sucesso!`,
        garagem: req.user.garagem,
      });
    } catch (error) {
      console.error('[AuthController.addGaragem] Erro:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar veículo na garagem.',
      });
    }
  },

  /**
   * DELETE /api/auth/garagem/:idOuPlaca
   * Remove uma placa da garagem do usuário
   */
  async removeGaragem(req, res) {
    try {
      const { idOuPlaca } = req.params;
      const target = (idOuPlaca || '').toUpperCase().trim();

      if (!target) {
        return res.status(400).json({
          success: false,
          error: 'Identificador do veículo é obrigatório.',
        });
      }

      const inicialCount = req.user.garagem.length;
      req.user.garagem = req.user.garagem.filter(
        (v) => v.id !== idOuPlaca && v.placa !== target
      );

      if (req.user.garagem.length === inicialCount) {
        return res.status(404).json({
          success: false,
          error: 'Veículo não encontrado na garagem.',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Veículo removido da garagem com sucesso.',
        garagem: req.user.garagem,
      });
    } catch (error) {
      console.error('[AuthController.removeGaragem] Erro:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao remover veículo da garagem.',
      });
    }
  },

  /**
   * GET /api/auth/historico
   * Lista o histórico de pagamentos e quitações do usuário
   */
  async getHistorico(req, res) {
    return res.status(200).json({
      success: true,
      historico: req.user.historico || [],
    });
  },

  /**
   * POST /api/auth/historico
   * Registra um comprovante de quitação no perfil do usuário
   */
  async addHistorico(req, res) {
    try {
      const { txid, placa, valorTotal, subtotal, taxa, protocolo, autenticacao, concessionaria } = req.body;

      if (!req.user.historico) {
        req.user.historico = [];
      }

      const novoComprovante = {
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        txid: txid || `TXID-${Date.now()}`,
        placa: (placa || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
        valorTotal: Number(valorTotal) || 0,
        subtotal: Number(subtotal) || 0,
        taxa: Number(taxa) || 1.00,
        dataHora: new Date().toLocaleString('pt-BR'),
        protocolo: protocolo || `PROT-${Math.floor(100000 + Math.random() * 900000)}`,
        autenticacao: autenticacao || `AUT-PIX-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        status: 'PAGO',
        concessionaria: concessionaria || 'Rede Free Flow Nacional',
        formaDePagamento: 'PIX Instantâneo',
        registradoEm: new Date().toISOString(),
      };

      req.user.historico.unshift(novoComprovante);

      return res.status(201).json({
        success: true,
        message: 'Comprovante registrado no histórico do usuário.',
        historico: req.user.historico,
      });
    } catch (error) {
      console.error('[AuthController.addHistorico] Erro:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao registrar comprovante no histórico.',
      });
    }
  },

  /**
   * POST /api/auth/alertas
   * Salva configurações de alertas (WhatsApp / E-mail)
   */
  async updateAlertas(req, res) {
    try {
      const { whatsapp, email, ativo, avisarComDias } = req.body;

      req.user.alertas = {
        whatsapp: (whatsapp || req.user.telefone || '').trim(),
        email: (email || req.user.email || '').trim(),
        ativo: ativo !== undefined ? Boolean(ativo) : true,
        avisarComDias: Number(avisarComDias) || 5,
        atualizadoEm: new Date().toISOString(),
      };

      return res.status(200).json({
        success: true,
        message: 'Preferências de alertas atualizadas com sucesso!',
        alertas: req.user.alertas,
      });
    } catch (error) {
      console.error('[AuthController.updateAlertas] Erro:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar alertas.',
      });
    }
  },
};

export default authController;
