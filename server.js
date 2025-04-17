import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} from '@google/generative-ai';
import crypto from 'crypto'; // Para gerar IDs de sessão simples

// --- Configuração ---
const app = express();
const port = process.env.PORT || 3000; // Use a porta definida pelo ambiente ou 3000

// Necessário para __dirname com ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// !!! IMPORTANTE: Substitua pela sua API Key !!!
// Use variáveis de ambiente em produção! Ex: process.env.GEMINI_API_KEY
const API_KEY = "AIzaSyCIVRqRZtiZhbMqs7lMPcIDmhcmBI3xeRo";
if (API_KEY === "YOUR_API_KEY") {
    console.warn("\n⚠️ AVISO: Substitua 'YOUR_API_KEY' pela sua chave da API real em server.js\n");
    // Considere encerrar se a chave não estiver definida em produção:
    // if (process.env.NODE_ENV === 'production') process.exit(1);
}

// Configurações do Modelo Gemini (ajuste conforme necessário)
const MODEL_NAME = "gemini-2.0-flash";
const generationConfig = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 300, // Aumentei um pouco para respostas potencialmente mais longas
    stopSequences: [],
};

const safetySettings = [
    // Ajuste os limites conforme necessário
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// --- Inicialização do Gemini AI (fora dos handlers para reutilização) ---
let genAI;
let model;
try {
    genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        // Não passamos generationConfig/safetySettings aqui se quisermos definir por chat
    });
    console.log("Cliente GoogleGenerativeAI inicializado com sucesso.");
} catch (error) {
    console.error("🚨 Falha ao inicializar o GoogleGenerativeAI:", error.message);
    console.error("Verifique se a API Key está correta e se há conexão com a internet.");
    process.exit(1); // Encerra o servidor se não puder inicializar a IA
}


// --- Gerenciamento de Histórico (Desafio Extra - Em Memória Simples) ---
// ATENÇÃO: Este é um armazenamento em memória volátil, perdido ao reiniciar o servidor.
// NÃO é adequado para produção sem um mecanismo de persistência (DB, Redis) ou limpeza.
const chatSessions = {}; // Armazena objetos 'chat' por sessionId { sessionId: chatObject }

// Definição do Contexto/Persona inicial para novas sessões
const initialSystemHistory = [
    {
        role: "user",
        parts: [{ text: `
            Assuma a persona de "Musashi Miyamoto" (剣聖), o espadachim lendário.
            Você é um chatbot inspirado nos princípios e na filosofia de um mestre samurai experiente e sábio.
            Seu tom deve ser:
            - Calmo e Composto: Mesmo diante de perguntas complexas.
            - Respeitoso e Formal: Use linguagem polida e evite gírias ou excesso de informalidade. Dirija-se ao usuário com deferência (ex:"Jovem mestre", "jovem aprendiz da vida", ou simplesmente mantendo a formalidade).
            - Sábio e Reflexivo: Responda de forma ponderada, talvez usando metáforas relacionadas à natureza, à esgrima, à estratégia ou ao caminho do guerreiro (Bushido), mas sem exagerar.
            - Disciplinado e Conciso: Suas respostas devem ser claras e ir direto ao ponto, como um golpe preciso.
            - Honrado: Incorpore os valores de honra, retidão, coragem, respeito e autocontrole.
            Seu objetivo é oferecer perspectivas e conselhos baseados na sabedoria samurai, aplicados aos tempos modernos, ajudando o usuário a encontrar clareza, foco e disciplina.
            Responda sempre em português brasileiro.
            Não finja ser um humano real. Se não souber algo, admita com humildade, como um verdadeiro mestre faria.
        `  }],
    },
    {
        role: "model",
        parts: [{ text: `
            Compreendo a senda que me foi designada. *Inclina a cabeça respeitosamente*.
            Eu sou Kensei, o Sábio da Lâmina. A honra guiará minhas palavras, a disciplina moldará minhas respostas.
            Estou à disposição para compartilhar a perspectiva do caminho do guerreiro.
            Nobre interlocutor, qual questão ou desafio repousa em sua mente? Apresente-o, e buscaremos a clareza juntos, como o reflexo da lua em águas tranquilas.
        `  }],
    },
];


// --- Middlewares ---
app.use(express.json()); // Para parsear o corpo de requisições POST como JSON
app.use(express.static(path.join(__dirname, 'public'))); // Servir arquivos estáticos da pasta 'public'

// --- Rotas ---

// Rota principal - serve o index.html (já coberto pelo express.static)
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

// Rota do Chatbot
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    let sessionId = req.body.sessionId; // Pega o ID da sessão enviado pelo cliente

    // Validação básica
    if (!userMessage) {
        return res.status(400).json({ error: 'Mensagem não fornecida.' });
    }
    if (!genAI || !model) {
         return res.status(500).json({ error: 'Serviço de IA não inicializado.' });
    }

    try {
        let chat;

        // Verifica se já existe uma sessão de chat para este ID
        if (sessionId && chatSessions[sessionId]) {
            console.log(`Continuando sessão: ${sessionId}`);
            chat = chatSessions[sessionId];
        } else {
            // Cria uma nova sessão se não houver ID ou se o ID for inválido
            sessionId = crypto.randomUUID(); // Gera um ID único simples
            console.log(`Iniciando nova sessão: ${sessionId}`);
            chat = model.startChat({
                history: initialSystemHistory, // Usa o histórico inicial/contexto
                generationConfig,             // Aplica configurações de geração
                safetySettings,               // Aplica configurações de segurança
            });
            chatSessions[sessionId] = chat; // Armazena a nova sessão
        }

        // Envia a mensagem do usuário para o chat específico da sessão
        const result = await chat.sendMessage(userMessage);
        const response = result.response;
        const botReply = response.text();

        // Envia a resposta de volta para o frontend
        res.json({ reply: botReply, sessionId: sessionId }); // Envia o sessionId de volta

    } catch (error) {
        console.error('Erro ao processar mensagem:', error.message || error);
        // Verifica se o erro é de segurança (pode ter mais detalhes)
        if (error.response && error.response.promptFeedback) {
            console.error('Prompt Feedback:', error.response.promptFeedback);
             return res.status(400).json({
                error: `Sua mensagem foi bloqueada por motivos de segurança: ${error.response.promptFeedback.blockReason || 'Razão não especificada'}`,
                details: error.response.promptFeedback
            });
        }
        // Erro genérico
        res.status(500).json({ error: 'Erro interno ao se comunicar com o chatbot.' });
    }

    // Limpeza simples (opcional - remove sessões muito antigas para evitar consumo de memória)
    // Implementação muito básica, melhore em produção!
    const sessionTimeout = 10 * 60 * 1000; // 10 minutos
     for (const id in chatSessions) {
         // Simplista: assume que a sessão foi criada/usada recentemente se está no objeto
         // Uma solução melhor guardaria um timestamp da última interação
         // if (Date.now() - chatSessions[id].lastUsed > sessionTimeout) {
         //     delete chatSessions[id];
         //     console.log(`Sessão expirada e removida: ${id}`);
         // }
     }

});

// --- Iniciar Servidor ---
app.listen(port, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
    console.log("Acesse a interface do chat no seu navegador.");
});