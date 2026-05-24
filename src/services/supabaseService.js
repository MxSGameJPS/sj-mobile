import { createClient } from "@supabase/supabase-js";
import { getApiBaseUrl } from "../config/api";

const SUPABASE_URL = "https://uwkcdwlgobnhowumcdnp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3a2Nkd2xnb2JuaG93dW1jZG5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTEyNDIsImV4cCI6MjA4OTE4NzI0Mn0.Nz-2pITIzlzZW-sePHXAyW6Kz19p45vlMN22Z8VEYEk";
const API_WEB_URL = getApiBaseUrl();

export const supabaseRealtime = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/**
 * Serviço leve de comunicação com o Supabase usando a API REST nativa.
 * Evita problemas de dependências nativas e bridges do React Native.
 */
export const supabaseService = {
  /**
   * Realiza login usando email e senha
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{session: Object, role: string, user: Object}>}
   */
  async signIn(email, password) {
    try {
      console.log("[SupabaseService] signIn iniciado para:", email);
      const response = await fetch(
        `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email, password }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.warn(
          "[SupabaseService] signIn falhou. Status:",
          response.status,
          "Payload:",
          JSON.stringify(data),
        );
        const errMsg =
          data.error_description ||
          data.error ||
          data.msg ||
          data.error_code ||
          "Erro ao realizar login";
        throw new Error(errMsg);
      }

      const userId = data.user?.id;
      const accessToken = data.access_token;

      // Buscar o papel (role) do usuário nas tabelas de negócio
      const role = await this.getUserRole(userId, accessToken);

      console.log(
        "[SupabaseService] signIn concluído. Role identificada:",
        role,
      );
      return {
        session: {
          accessToken,
          expiresAt: data.expires_at,
          refreshToken: data.refresh_token,
        },
        user: data.user,
        role,
      };
    } catch (error) {
      console.error("[SupabaseService] Erro no signIn:", error);
      throw error;
    }
  },

  /**
   * Realiza logout do usuário (invalida token no Supabase e limpa sessão local)
   * @param {string} [accessToken] - Token de acesso para invalidar remotamente
   */
  async signOut(accessToken) {
    try {
      if (accessToken) {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
          },
        });
      }
    } catch (err) {
      console.warn("[SupabaseService] Erro ao invalidar token remoto:", err);
    }
    try {
      await supabaseRealtime.auth.signOut();
    } catch (err) {
      console.warn("[SupabaseService] Erro ao limpar sessão local:", err);
    }
  },

  /**
   * Verifica se a OAB já existe no banco de dados para a UF informada
   * @param {string} oab
   * @param {string} estado
   * @returns {Promise<boolean>}
   */
  async checkOabExists(oab, estado) {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/check_oab_exists`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ p_oab: oab, p_estado: estado }),
        },
      );

      if (!response.ok) {
        throw new Error("Erro ao validar OAB");
      }

      return await response.json();
    } catch (error) {
      console.error("[SupabaseService] Erro no checkOabExists:", error);
      throw error;
    }
  },

  /**
   * Realiza o cadastro do usuário (Auth + Criação de Perfil via RPC)
   * @param {Object} userData
   * @returns {Promise<Object>}
   */
  async signUp(userData) {
    const {
      email,
      password,
      name,
      phone,
      role,
      oab,
      estado,
      origem_descoberta,
    } = userData;
    try {
      // 1. Criar o usuário no Auth (dispara e-mail de confirmação em segundo plano)
      const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          data: {
            full_name: name,
            role: role,
          },
        }),
      });

      const signupData = await signupRes.json();

      if (!signupRes.ok) {
        throw new Error(
          signupData.error_description ||
            signupData.error ||
            signupData.message ||
            "Erro ao criar conta de autenticação",
        );
      }

      const userId = signupData.id || signupData.user?.id;
      if (!userId) {
        throw new Error("Usuário criado, mas ID não retornado pelo Supabase.");
      }

      // 2. Criar perfil na tabela de negócio correspondente (clientes ou advogados)
      const rpcRes = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/create_profile_public`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            p_user_id: userId,
            p_email: email.trim().toLowerCase(),
            p_name: name,
            p_phone: phone,
            p_role: role,
            p_origem_descoberta: origem_descoberta || "Não informado",
            p_oab: oab || null,
            p_estado: estado || null,
          }),
        },
      );

      if (!rpcRes.ok) {
        const rpcError = await rpcRes.json().catch(() => ({}));
        throw new Error(
          rpcError.message || "Erro ao salvar perfil no banco de dados.",
        );
      }

      return {
        success: true,
        user: signupData.user || signupData,
      };
    } catch (error) {
      console.error("[SupabaseService] Erro no signUp:", error);
      throw error;
    }
  },

  /**
   * Identifica a role do usuário no banco de dados
   * @param {string} userId
   * @param {string} accessToken
   * @returns {Promise<string>} 'ADMIN' | 'LAWYER' | 'CLIENT' | 'GUEST'
   */
  async getUserRole(userId, accessToken) {
    if (!userId) return "GUEST";

    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    try {
      // 1. Verificar se é administrador
      const adminRes = await fetch(
        `${SUPABASE_URL}/rest/v1/admins?id=eq.${userId}&select=role`,
        { headers },
      );
      if (adminRes.ok) {
        const admins = await adminRes.json();
        if (admins && admins.length > 0) {
          return admins[0].role || "ADMIN";
        }
      }

      // 2. Verificar se é advogado
      const lawyerRes = await fetch(
        `${SUPABASE_URL}/rest/v1/advogados?id=eq.${userId}&select=id`,
        { headers },
      );
      if (lawyerRes.ok) {
        const lawyers = await lawyerRes.json();
        if (lawyers && lawyers.length > 0) {
          return "LAWYER";
        }
      }

      // 3. Verificar se é cliente
      const clientRes = await fetch(
        `${SUPABASE_URL}/rest/v1/clientes?id=eq.${userId}&select=id`,
        { headers },
      );
      if (clientRes.ok) {
        const clients = await clientRes.json();
        if (clients && clients.length > 0) {
          return "CLIENT";
        }
      }

      return "GUEST";
    } catch (error) {
      console.error("[SupabaseService] Erro ao identificar role:", error);
      return "GUEST";
    }
  },

  /**
   * Busca os interesses declarados pelo advogado (ativos)
   * Usa fetch autenticado para garantir que o token do usuário seja enviado ao banco
   */
  async getLawyerInterests(userId, accessToken) {
    if (!userId || !accessToken) return [];
    try {
      const headers = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      };

      // 1. Busca os interesses com fetch autenticado
      const iRes = await fetch(
        `${SUPABASE_URL}/rest/v1/case_interests?lawyer_id=eq.${userId}&status=in.(PENDING,NEGOTIATING)&select=id,case_id,status,created_at&order=created_at.desc`,
        { headers },
      );
      if (!iRes.ok)
        throw new Error(`Erro ao buscar interesses: ${iRes.status}`);
      const interests = await iRes.json();

      if (!interests || interests.length === 0) return [];

      // 2. Busca os detalhes dos casos
      const caseIds = interests.map((i) => i.case_id).join(",");
      const cRes = await fetch(
        `${SUPABASE_URL}/rest/v1/casos?id=in.(${caseIds})&select=id,cliente_id,advogado_id,titulo,descricao,status,area_atuacao,valor_proposto,created_at,updated_at,anexos,chat_started,negotiating_lawyers,cidade,estado`,
        { headers },
      );
      if (!cRes.ok)
        throw new Error(`Erro ao buscar casos dos interesses: ${cRes.status}`);
      const casesData = await cRes.json();

      // 3. Junta tudo num objeto igual à Web
      return interests.map((interest) => {
        const caso = (casesData || []).find((c) => c.id === interest.case_id);
        return {
          ...interest,
          casos: caso || null,
        };
      });
    } catch (error) {
      console.error("[SupabaseService] getLawyerInterests:", error);
      return [];
    }
  },

  /**
   * Busca os casos oficiais onde o advogado foi contratado
   * Usa fetch autenticado para garantir que o token do usuário seja enviado ao banco
   */
  async getLawyerCases(userId, accessToken) {
    if (!userId || !accessToken) return [];
    try {
      const headers = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      };

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/casos?advogado_id=eq.${userId}&select=id,cliente_id,advogado_id,titulo,descricao,status,area_atuacao,valor_proposto,created_at,updated_at,anexos,chat_started,negotiating_lawyers,cidade,estado&order=created_at.desc`,
        { headers },
      );
      if (!res.ok)
        throw new Error(`Erro ao buscar casos do advogado: ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error("[SupabaseService] getLawyerCases:", error);
      return [];
    }
  },

  /**
   * Busca os casos disponíveis no Marketplace (ABERTO ou NEGOCIANDO e sem advogado)
   */
  async getMarketplaceCases(accessToken) {
    if (!accessToken) return [];
    try {
      const scopedSupabase = supabaseRealtime;

      const { data, error } = await scopedSupabase
        .from("casos")
        .select(
          "id, cliente_id, advogado_id, titulo, descricao, status, area_atuacao, valor_proposto, created_at, updated_at, anexos, chat_started, negotiating_lawyers, cidade, estado",
        )
        .is("advogado_id", null)
        .in("status", ["ABERTO", "NEGOCIANDO"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("[SupabaseService] getMarketplaceCases:", error);
      return [];
    }
  },

  /**
   * Busca os dados do perfil do cliente
   * @param {string} userId
   * @param {string} accessToken
   * @returns {Promise<Object>}
   */
  async getClientProfile(userId, accessToken, email = null) {
    if (!userId) return null;
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    try {
      // 1. Tentar buscar por ID
      let response = await fetch(
        `${SUPABASE_URL}/rest/v1/clientes?id=eq.${userId}&select=*`,
        { headers },
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) return data[0];
      }

      // 2. Fallback por e-mail se fornecido
      if (email) {
        const responseEmail = await fetch(
          `${SUPABASE_URL}/rest/v1/clientes?email=eq.${email}&select=*`,
          { headers },
        );
        if (responseEmail.ok) {
          const dataEmail = await responseEmail.json();
          if (dataEmail && dataEmail.length > 0) return dataEmail[0];
        }
      }
      return null;
    } catch (error) {
      console.error("[SupabaseService] Erro no getClientProfile:", error);
      throw error;
    }
  },

  /**
   * Busca os casos associados a um cliente
   * @param {string} userId
   * @param {string} accessToken
   * @returns {Promise<Array>}
   */
  async getClientCases(userId, accessToken) {
    if (!userId) return [];
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/casos?cliente_id=eq.${userId}&select=*`,
        { headers },
      );
      if (!response.ok) throw new Error("Erro ao buscar casos do cliente");
      return await response.json();
    } catch (error) {
      console.error("[SupabaseService] Erro no getClientCases:", error);
      throw error;
    }
  },

  /**
   * Busca as informações de um advogado pelo seu ID
   * @param {string} lawyerId
   * @param {string} accessToken
   * @returns {Promise<Object>}
   */
  async getLawyer(lawyerId, accessToken) {
    if (!lawyerId) return null;
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/advogados?id=eq.${lawyerId}&select=*`,
        { headers },
      );
      if (!response.ok) throw new Error("Erro ao buscar advogado");
      const data = await response.json();
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error("[SupabaseService] Erro no getLawyer:", error);
      throw error;
    }
  },

  /**
   * Cria um novo caso no banco de dados
   * @param {Object} caseData
   * @param {string} accessToken
   * @returns {Promise<Object>}
   */
  async createCase(caseData, accessToken) {
    try {
      const response = await fetch(`${API_WEB_URL}/casos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(caseData),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Erro ao publicar caso");
      }
      return data.data || data;
    } catch (error) {
      console.error("[SupabaseService] Erro no createCase:", error);
      throw error;
    }
  },

  async updateCase(caseId, updateData, accessToken) {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/casos?id=eq.${caseId}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify(updateData),
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Erro ao atualizar caso");
      }
      return true;
    } catch (error) {
      console.error("[SupabaseService] Erro no updateCase:", error);
      throw error;
    }
  },

  async deleteCase(caseId, accessToken) {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    };
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/casos?id=eq.${caseId}`,
        {
          method: "DELETE",
          headers,
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Erro ao excluir caso");
      }
      return true;
    } catch (error) {
      console.error("[SupabaseService] Erro no deleteCase:", error);
      throw error;
    }
  },

  async submitReview(reviewData, accessToken) {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/avaliacoes`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...reviewData,
          created_at: new Date().toISOString(),
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Erro ao salvar avaliação");
      }
      return true;
    } catch (error) {
      console.error("[SupabaseService] Erro no submitReview:", error);
      throw error;
    }
  },

  /**
   * Atualiza as informações do perfil do cliente
   * @param {string} userId
   * @param {Object} profileData
   * @param {string} accessToken
   * @returns {Promise<Object>}
   */
  async updateClientProfile(userId, profileData, accessToken) {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/clientes?id=eq.${userId}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify(profileData),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Erro ao atualizar perfil");
      }
      return data && data.length > 0 ? data[0] : data;
    } catch (error) {
      console.error("[SupabaseService] Erro no updateClientProfile:", error);
      throw error;
    }
  },

  /**
   * Atualiza a senha da conta de usuário no auth do Supabase
   * @param {string} password
   * @param {string} accessToken
   * @returns {Promise<Object>}
   */
  async updateAuthPassword(password, accessToken) {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error_description || data.error || "Erro ao atualizar senha",
        );
      }
      return data;
    } catch (error) {
      console.error("[SupabaseService] Erro no updateAuthPassword:", error);
      throw error;
    }
  },

  /**
   * Exclui a conta do cliente (remove do banco de dados)
   * @param {string} userId
   * @param {string} accessToken
   * @returns {Promise<boolean>}
   */
  async deleteAccount(userId, accessToken) {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/clientes?id=eq.${userId}`,
        {
          method: "DELETE",
          headers,
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao excluir conta");
      }
      return true;
    } catch (error) {
      console.error("[SupabaseService] Erro no deleteAccount:", error);
      throw error;
    }
  },

  /**
   * Busca as mensagens de um caso específico
   * @param {string} caseId
   * @param {string} accessToken
   * @param {string} interestId
   * @returns {Promise<Array>}
   */
  async getCaseMessages(caseId, accessToken, interestId = null) {
    if (!caseId) return [];
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    try {
      const filter = interestId
        ? `caso_id=eq.${caseId}&interest_id=eq.${interestId}`
        : `caso_id=eq.${caseId}&interest_id=is.null`;
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/mensagens?${filter}&select=*&order=created_at.asc`,
        { headers },
      );
      if (!response.ok) throw new Error("Erro ao buscar mensagens");
      return await response.json();
    } catch (error) {
      console.error("[SupabaseService] Erro no getCaseMessages:", error);
      throw error;
    }
  },

  /**
   * Envia uma mensagem para o caso no banco de dados
   * @param {Object} messageData
   * @param {string} accessToken
   * @returns {Promise<Object>}
   */
  async sendCaseMessage(messageData, accessToken) {
    try {
      const response = await fetch(`${API_WEB_URL}/mensagens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(messageData),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Erro ao enviar mensagem");
      }
      return data.data || data;
    } catch (error) {
      console.error("[SupabaseService] Erro no sendCaseMessage:", error);
      throw error;
    }
  },

  /**
   * Faz o upload de um arquivo local para o storage do Supabase (bucket cases)
   * e retorna a URL pública do arquivo.
   * @param {string} localUri - URI do arquivo local
   * @param {string} fileName - Nome original do arquivo
   * @param {string} mimeType - Tipo mime do arquivo
   * @param {string} accessToken - Token de acesso do usuário
   * @returns {Promise<string>} URL pública do arquivo
   */
  async uploadCaseAttachment(localUri, fileName, mimeType, accessToken) {
    try {
      // 1. Converter URI local para Blob
      const response = await fetch(localUri);
      const blob = await response.blob();

      // 2. Definir o caminho do arquivo no bucket
      const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const uniquePath = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${cleanFileName}`;

      const headers = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": mimeType || "application/octet-stream",
      };

      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/cases/${uniquePath}`;

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers,
        body: blob,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(
          uploadData.message || "Erro no upload para o Supabase Storage",
        );
      }

      // Retorna a URL pública
      return `${SUPABASE_URL}/storage/v1/object/public/cases/${uniquePath}`;
    } catch (error) {
      console.error("[SupabaseService] Erro no uploadCaseAttachment:", error);
      throw error;
    }
  },

  /**
   * Busca todos os advogados do banco
   */
  async getLawyersList(accessToken) {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/advogados?select=*`,
        { headers },
      );
      if (!response.ok) throw new Error("Erro ao buscar advogados");
      return await response.json();
    } catch (error) {
      console.error("[SupabaseService] Erro no getLawyersList:", error);
      return [];
    }
  },

  /**
   * Busca todos os escritórios do banco
   */
  async getOfficesList(accessToken) {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/escritorios?select=*`,
        { headers },
      );
      if (!response.ok) throw new Error("Erro ao buscar escritórios");
      return await response.json();
    } catch (error) {
      console.error("[SupabaseService] Erro no getOfficesList:", error);
      return [];
    }
  },

  /**
   * Busca interesses ativos associados aos casos do cliente
   */
  async getCaseInterests(clientId, accessToken) {
    if (!clientId) return [];
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    try {
      // Primeiro buscamos todos os casos do cliente
      const casos = await this.getClientCases(clientId, accessToken);
      if (!casos || casos.length === 0) return [];

      const caseIds = casos.map((c) => c.id);

      // Consultamos os interesses para estes casos
      const filter = `case_id=in.(${caseIds.join(",")})`;
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/case_interests?${filter}&select=*&order=created_at.desc`,
        { headers },
      );
      if (!response.ok) throw new Error("Erro ao buscar interesses do caso");
      const interests = await response.json();

      // Enriquecer com dados do caso correspondente
      return interests.map((interest) => {
        const caso = casos.find((c) => c.id === interest.case_id);
        return {
          ...interest,
          caso: caso || null,
        };
      });
    } catch (error) {
      console.error("[SupabaseService] Erro no getCaseInterests:", error);
      return [];
    }
  },

  /**
   * Responde a uma proposta de advogado (ACCEPT, DECLINE, HIRE)
   */
  async respondToInterest(interestId, caseId, lawyerId, action, accessToken) {
    try {
      const response = await fetch(`${API_WEB_URL}/casos/interesse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ interestId, action }),
      });

      const contentType = response.headers.get("content-type") || "";
      const rawBody = await response.text();
      const data = contentType.includes("application/json")
        ? JSON.parse(rawBody || "{}")
        : (() => {
            try {
              return JSON.parse(rawBody || "{}");
            } catch {
              return {
                success: false,
                message: rawBody || "Resposta inválida da API",
              };
            }
          })();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Erro ao responder interesse");
      }

      return data;
    } catch (error) {
      console.error("[SupabaseService] Erro no respondToInterest:", error);
      throw error;
    }
  },

  /**
   * Atualiza as informações de um caso
   */
  async updateCase(caseId, caseData, accessToken) {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/casos?id=eq.${caseId}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            ...caseData,
            updated_at: new Date().toISOString(),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Erro ao atualizar caso");
      return data && data.length > 0 ? data[0] : data;
    } catch (error) {
      console.error("[SupabaseService] Erro no updateCase:", error);
      throw error;
    }
  },

  /**
   * Exclui um caso
   */
  async deleteCase(caseId, accessToken) {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/casos?id=eq.${caseId}`,
        {
          method: "DELETE",
          headers,
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao excluir caso");
      }
      return true;
    } catch (error) {
      console.error("[SupabaseService] Erro no deleteCase:", error);
      throw error;
    }
  },

  /**
   * Busca as notificações do usuário
   */
  async getNotifications(userId, accessToken) {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/notificacoes?user_id=eq.${userId}&order=created_at.desc`,
        { headers },
      );
      if (!response.ok) throw new Error("Erro ao buscar notificações");
      return await response.json();
    } catch (error) {
      console.error("[SupabaseService] Erro no getNotifications:", error);
      return [];
    }
  },

  /**
   * Marca uma notificação como lida
   */
  async markNotificationRead(notificationId, accessToken) {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/notificacoes?id=eq.${notificationId}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ lida: true }),
        },
      );
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Exclui uma notificação
   */
  async deleteNotification(notificationId, accessToken) {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/notificacoes?id=eq.${notificationId}`,
        {
          method: "DELETE",
          headers,
        },
      );
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Envia uma avaliação do advogado
   */
  async submitReview(reviewData, accessToken) {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/avaliacoes`, {
        method: "POST",
        headers,
        body: JSON.stringify(reviewData),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Erro ao enviar avaliação");
      return data;
    } catch (error) {
      console.error("[SupabaseService] Erro no submitReview:", error);
      throw error;
    }
  },

  /**
   * Requisita a análise da IA do Anjo Jurídico para a Web API
   */
  async requestChatAiAnalysis(caseId, interestId, messageId, accessToken) {
    try {
      const response = await fetch(`${API_WEB_URL}/chat/analise-ia`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          caso_id: caseId,
          interest_id: interestId || null,
          mensagem_id: messageId,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Erro ao gerar análise de IA.");
      }
      return data.data; // retorna os dados da análise (analise_texto)
    } catch (error) {
      console.error("[SupabaseService] Erro na análise IA:", error);
      throw error;
    }
  },
};
