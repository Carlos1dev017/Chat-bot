// index.js (Backend - Exemplo com Express e ES Modules)
import express from 'express';
// Removido: import path from 'path'; // Não necessário se usar index.html
// Removido: import { fileURLToPath } from 'url'; // Não necessário se usar index.html
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config(); // Carrega as variáveis do .env PRIMEIRO

// --- Configuração opcional para __dirname se precisar (não usado neste código) ---
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// ---

const app = express();
const port = 3000; // Ou outra porta

// --- Middlewares ---
// 1. Servir arquivos estáticos (HTML, CSS, JS do Cliente) da pasta 'public'
//    Isso automaticamente serve public/index.html quando você acessa '/'
app.use(express.static('public'));

// 2. Parsear corpos de requisição JSON (essencial para req.body)
app.use(express.json());

// --- Configuração do Google Generative AI ---
// Verifica se a chave API foi carregada
if (!process.env.GOOGLE_API_KEY) {
    console.error("!!! ERRO FATAL: GOOGLE_API_KEY não encontrada no .env !!!");
    process.exit(1); // Encerra o processo se a chave estiver faltando
}
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Obter o modelo generativo - Usando gemini-1.5-flash-latest
// Removidas configs de geração/segurança temporariamente para teste
console.log("Usando modelo Gemini: gemini-1.5-flash-latest");
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash-latest"
  // generationConfig e safetySettings omitidos por enquanto para simplificar
});

// --- Endpoint da API para o Chat ---
app.post('/api/chat', async (req, res) => {
    const userPrompt = req.body.prompt; // Pega o prompt do corpo da requisição
    console.log(`[${new Date().toISOString()}] Recebido prompt: "${userPrompt}"`); // Log com timestamp

    try {
        // Validação do prompt
        if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim() === '') {
            console.warn("Alerta: Prompt inválido ou vazio recebido."); // Use warn para avisos
            return res.status(400).json({ error: 'Nenhum prompt válido foi fornecido.' }); // Retorna 400 Bad Request
        }

        // Inicia uma sessão de chat
        // Removidos history e generationConfig aqui também para simplificar testes
        const chat = model.startChat({
           history: [] // Começa com histórico vazio (ou gerencie o histórico se necessário)
           // generationConfig e safetySettings omitidos
        });

        // Envia a mensagem do usuário para a sessão de chat
        console.log("Enviando prompt para a API Gemini...");
        const result = await chat.sendMessage(userPrompt.trim()); // Usa trim() para limpar espaços extras

        // Obtém a resposta
        const response = result.response;

        // Validação robusta da resposta
        if (!response || typeof response.text !== 'function') {
           console.error("!!! Resposta inesperada da API Gemini:", response);
           // Lança um erro para ser pego pelo bloco catch
           throw new Error("Formato de resposta inválido recebido da API Gemini.");
        }

        // Extrai o texto da resposta
        const text = response.text();
        console.log(`[${new Date().toISOString()}] Resposta da IA: "${text}"`); // Log com timestamp

        // Envia a resposta da IA de volta para o frontend
        res.json({ reply: text });

    } catch (error) {
        // --- Tratamento de Erro Aprimorado ---
        console.error(`\n!!! ERRO NO ENDPOINT /api/chat !!!`);
        console.error(`Timestamp: ${new Date().toISOString()}`);
        console.error(`Prompt Recebido: "${userPrompt}"`); // Loga o prompt que pode ter causado o erro

        // Verifica se é um erro específico da API do Google para mais detalhes
        if (error instanceof Error && error.message.includes('GoogleGenerativeAI')) { // Checagem mais genérica do nome/mensagem
            console.error("Tipo de Erro: Google Generative AI");
            // Tenta logar detalhes adicionais se disponíveis (pode variar com a versão da lib)
            if (error.status) console.error("Status HTTP (se aplicável):", error.status);
            if (error.statusText) console.error("Status Text (se aplicável):", error.statusText);
            if (error.errorDetails) console.error("Detalhes do Erro da API:", error.errorDetails);
        } else {
            console.error("Tipo de Erro: Erro Geral do Servidor");
        }

        // Loga o objeto de erro completo, incluindo stack trace (essencial para depuração)
        console.error("Erro Detalhado Completo:", error);
        console.error("--- Fim do Log de Erro ---\n");
        // --- Fim do Tratamento de Erro Aprimorado ---

        // Envia uma resposta genérica 500 para o cliente
        // IMPORTANTE: Não envie detalhes internos do erro para o cliente por segurança
        res.status(500).json({ error: 'Ocorreu um erro interno no servidor ao processar sua solicitação.' });
    }
});

// --- Inicia o Servidor ---
app.listen(port, () => {
    console.log(`\nServidor Express iniciado com sucesso.`);
    console.log(`Escutando na porta: ${port}`);
    console.log(`Acesse a aplicação em: http://localhost:${port}`);
    console.log(`Servindo arquivos estáticos da pasta: 'public'`);
    console.log(`Pressione CTRL+C para parar o servidor.\n`);
});

// --- Tratamento para Encerramento Gracioso (Opcional mas bom) ---
process.on('SIGINT', () => {
    console.log('\nRecebido SIGINT (Ctrl+C). Encerrando o servidor...');
    // Aqui você pode adicionar lógicas de limpeza se necessário (ex: fechar DB)
    process.exit(0);
});