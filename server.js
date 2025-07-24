// server.js

// Importa as bibliotecas necessárias
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

// Configuração do servidor
const app = express();
const server = http.createServer(app);
// O 'cors' permite que o nosso frontend (em um domínio diferente) se conecte a este backend
const io = new Server(server, {
  cors: {
    origin: "*", // Em produção, você deve restringir isso ao URL do seu frontend
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Armazenamento em memória para as salas.
// Para uma aplicação real, você usaria um banco de dados como o PostgreSQL do Render.
let rooms = {};

// Evento principal: acontece quando um novo utilizador se conecta
io.on('connection', (socket) => {
  console.log(`Utilizador conectado: ${socket.id}`);

  // --- GESTÃO DE SALAS ---

  // Quando um utilizador quer criar uma sala
  socket.on('create-room', (callback) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[roomId] = {
      users: [],
      videoState: {
        videoId: null,
        state: 'PAUSED',
        time: 0,
      }
    };
    console.log(`Sala criada: ${roomId}`);
    callback(roomId); // Envia o ID da sala de volta para o criador
  });

  // Quando um utilizador quer entrar numa sala
  socket.on('join-room', ({ roomId, userId }, callback) => {
    if (!rooms[roomId]) {
      return callback({ error: 'Sala não encontrada.' });
    }

    socket.join(roomId); // Coloca o socket do utilizador na sala
    rooms[roomId].users.push(userId);
    console.log(`Utilizador ${userId} entrou na sala ${roomId}`);

    // Envia o estado atual do vídeo para o novo utilizador
    socket.emit('initial-state', rooms[roomId].videoState);

    callback({ success: true });
  });


  // --- SINCRONIZAÇÃO DE VÍDEO ---

  // Quando alguém muda o vídeo
  socket.on('video-change', ({ roomId, videoId }) => {
    if (rooms[roomId]) {
      rooms[roomId].videoState = { videoId, state: 'PAUSED', time: 0 };
      // Envia a mudança para TODOS na sala, incluindo quem mudou
      io.to(roomId).emit('video-changed', videoId);
      console.log(`Vídeo alterado na sala ${roomId} para ${videoId}`);
    }
  });

  // Quando alguém dá play, pausa ou avança o vídeo
  socket.on('video-sync', ({ roomId, state, time }) => {
    if (rooms[roomId]) {
      rooms[roomId].videoState.state = state;
      rooms[roomId].videoState.time = time;
      // Envia a atualização para todos os OUTROS na sala
      socket.to(roomId).emit('video-synced', { state, time });
    }
  });


  // --- CHAT ---

  // Quando alguém envia uma mensagem no chat
  socket.on('chat-message', ({ roomId, message }) => {
    // Envia a mensagem para TODOS na sala
    io.to(roomId).emit('new-chat-message', message);
    console.log(`Mensagem na sala ${roomId}: ${message.text}`);
  });


  // --- DESCONEXÃO ---

  socket.on('disconnect', () => {
    console.log(`Utilizador desconectado: ${socket.id}`);
    // Opcional: remover o utilizador das salas, etc.
    // Para simplificar, não implementamos a remoção de utilizadores da lista.
  });
});

// Rota de verificação de saúde para o Render saber que o servidor está vivo
app.get('/', (req, res) => {
  res.send('Servidor Watch Party está a funcionar!');
});

server.listen(PORT, () => {
  console.log(`Servidor a escutar na porta ${PORT}`);
});
