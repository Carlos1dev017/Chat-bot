// public/chat-client.js
const chatbox = document.getElementById('chatbox');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');

function addMessage(message, className) {
    const div = document.createElement('div');
    div.textContent = message;
    div.className = className; // Para estilização (user-message ou bot-message)
    chatbox.appendChild(div);
    chatbox.scrollTop = chatbox.scrollHeight; // Rola para a última mensagem
}

async function sendMessageToServer() {
    const prompt = userInput.value.trim();
    if (!prompt) return; // Não envia mensagem vazia

    addMessage(prompt, 'user-message'); // Mostra a mensagem do usuário
    userInput.value = ''; // Limpa o input
    sendButton.disabled = true; // Desabilita o botão enquanto espera

    try {
        // Envia o prompt para o endpoint da API no backend
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: prompt }), // Envia o prompt como JSON
        });

        if (!response.ok) {
            throw new Error(`Erro do servidor: ${response.statusText}`);
        }

        const data = await response.json(); // Pega a resposta JSON do servidor
        addMessage(data.reply, 'bot-message'); // Mostra a resposta da IA

    } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
        addMessage("Erro ao conectar com o bot.", 'bot-message');
    } finally {
         sendButton.disabled = false; // Reabilita o botão
    }
}

sendButton.addEventListener('click', sendMessageToServer);

// Permite enviar com Enter
userInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        sendMessageToServer();
    }
});

// Mensagem inicial (opcional)
addMessage("Olá! Como posso ajudar?", 'bot-message');