const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');

// Variável para armazenar o histórico do lado do cliente (opcional, mas útil)
// O histórico real será mantido no servidor se implementado lá
let clientHistory = [];
let currentSessionId = null; // Para manter o ID da sessão de chat no servidor

// --- Funções Auxiliares ---
function addMessage(message, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${sender}-message`);
    messageDiv.textContent = message;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll para a última mensagem
}

function showTypingIndicator(show = true) {
    removeTypingIndicator(); // Remove qualquer indicador existente
    if (show) {
        const typingDiv = document.createElement('div');
        typingDiv.classList.add('message', 'bot-message', 'typing-indicator');
        typingDiv.textContent = 'Meditando...';
        typingDiv.id = 'typing';
        chatBox.appendChild(typingDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

function removeTypingIndicator() {
    const typingDiv = document.getElementById('typing');
    if (typingDiv) {
        typingDiv.remove();
    }
}

// --- Função Principal de Envio ---
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return; // Não envia mensagens vazias

    addMessage(message, 'user'); // Mostra a mensagem do usuário
    clientHistory.push({ role: 'user', text: message }); // Adiciona ao histórico local
    userInput.value = ''; // Limpa o input
    showTypingIndicator(); // Mostra "Digitando..."

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // Envia a mensagem e o ID da sessão atual (se houver)
            body: JSON.stringify({ message: message, sessionId: currentSessionId }),
        });

        removeTypingIndicator(); // Remove "Digitando..."

        if (!response.ok) {
            // Tenta pegar a mensagem de erro do servidor, se houver
            const errorData = await response.json().catch(() => ({})); // Evita erro se a resposta não for JSON
            console.error('Erro na resposta do servidor:', response.status, errorData);
            addMessage(`Erro ${response.status}: ${errorData.error || 'Não foi possível obter a resposta do chatbot.'}`, 'bot');
            return;
        }

        const data = await response.json();

        if (data.reply) {
            addMessage(data.reply, 'bot'); // Mostra a resposta do bot
            clientHistory.push({ role: 'model', text: data.reply }); // Adiciona ao histórico local
            currentSessionId = data.sessionId; // Atualiza o ID da sessão para a próxima requisição
        } else {
             addMessage('Recebi uma resposta vazia do bot.', 'bot');
        }

    } catch (error) {
        removeTypingIndicator();
        console.error('Erro ao enviar mensagem:', error);
        addMessage('Ocorreu um erro de conexão. Tente novamente.', 'bot');
    }
}

// --- Event Listeners ---
sendButton.addEventListener('click', sendMessage);

// Permite enviar com Enter
userInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});