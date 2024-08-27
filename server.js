const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

const server = http.createServer((req, res) => {
    if (req.url === '/') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading index.html');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url === '/script.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        fs.createReadStream(path.join(__dirname, 'script.js')).pipe(res);
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

const wss = new WebSocket.Server({ server });

let players = [];
let gameState = {
    board: [
        ['A-P1', 'A-P2', 'A-H1', 'A-H2', 'A-P3'],
        [null, null, null, null, null],
        [null, null, null, null, null],
        [null, null, null, null, null],
        ['B-P1', 'B-P2', 'B-H1', 'B-H2', 'B-P3']
    ],
    currentPlayer: 'A',
    gameEnded: false
};

wss.on('connection', ws => {
    // Assign player ID
    let playerId;
    if (players.length === 0) {
        playerId = 'A';
    } else if (players.length === 1) {
        playerId = 'B';
    } else {
        ws.send(JSON.stringify({ action: 'full', message: 'Game is full' }));
        ws.close();
        return;
    }
    players.push(ws);

    players.forEach(player => {
        if (player.readyState === WebSocket.OPEN) {
            player.send(JSON.stringify({ action: 'joined', playerId }));
        }
    });

    if (players.length === 2) {
        players.forEach(player => {
            if (player.readyState === WebSocket.OPEN) {
                player.send(JSON.stringify({ action: 'start', message: 'Both players joined. Player A starts.' }));
            }
        });
    }

    ws.on('message', message => {
        const { action, data } = JSON.parse(message);

        if (action === 'update') {
            if (data.currentPlayer === gameState.currentPlayer) {
                gameState = { ...gameState, ...data };
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ action: 'update', data: gameState }));
                    }
                });
                gameState.currentPlayer = gameState.currentPlayer === 'A' ? 'B' : 'A';
            }
        }
    });

    ws.send(JSON.stringify({ action: 'update', data: gameState }));
});

server.listen(3000, () => {
    console.log('Server is listening on port 3000');
});
