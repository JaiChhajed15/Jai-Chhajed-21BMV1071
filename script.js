const boardElement = document.getElementById('board');
const winnerElement = document.getElementById('winner');
const historyElement = document.getElementById('history');
const statusElement = document.getElementById('status');

const boardSize = 5;
let currentPlayer = null;
let selectedCell = null;
let gameEnded = false;

const socket = new WebSocket('ws://localhost:3000');

let board = [
    ['A-P1', 'A-P2', 'A-H1', 'A-H2', 'A-P3'],
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
    ['B-P1', 'B-P2', 'B-H1', 'B-H2', 'B-P3']
];

function createBoard() {
    boardElement.innerHTML = '';
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.innerText = board[row][col] ? board[row][col] : '';
            cell.onclick = () => selectCell(row, col);
            boardElement.appendChild(cell);
        }
    }
}

// Handle cell selection
function selectCell(row, col) {
    if (gameEnded || currentPlayer === null) return;

    const cellContent = board[row][col];
    if (cellContent && cellContent.startsWith(currentPlayer)) {
        selectedCell = { row, col, piece: cellContent };
        updateSelected();
        updateAvailableMoves(cellContent);
    }
}

function updateSelected() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => cell.classList.remove('selected'));

    if (selectedCell) {
        const selectedCellElement = document.querySelector(`.cell[data-row="${selectedCell.row}"][data-col="${selectedCell.col}"]`);
        selectedCellElement.classList.add('selected');
    }
}

function updateAvailableMoves(piece) {
    document.querySelectorAll('.controls button').forEach(button => button.disabled = true);

    if (piece.includes('P')) {
        document.getElementById('L').disabled = false;
        document.getElementById('R').disabled = false;
        document.getElementById('F').disabled = false;
        document.getElementById('B').disabled = false;
    } else if (piece.includes('H1')) {
        document.getElementById('L').disabled = false;
        document.getElementById('R').disabled = false;
        document.getElementById('F').disabled = false;
        document.getElementById('B').disabled = false;
    } else if (piece.includes('H2')) {
        document.getElementById('FL').disabled = false;
        document.getElementById('FR').disabled = false;
        document.getElementById('BL').disabled = false;
        document.getElementById('BR').disabled = false;
    }
}

function movePiece(direction) {
    if (!selectedCell || gameEnded || currentPlayer === null) return;

    const { row, col, piece } = selectedCell;
    let newRow = row, newCol = col;

    const movement = {
        'L': { rowChange: 0, colChange: -1 },
        'R': { rowChange: 0, colChange: 1 },
        'F': { rowChange: currentPlayer === 'A' ? 1 : -1, colChange: 0 },
        'B': { rowChange: currentPlayer === 'A' ? -1 : 1, colChange: 0 },
        'FL': { rowChange: currentPlayer === 'A' ? 1 : -1, colChange: -1 },
        'FR': { rowChange: currentPlayer === 'A' ? 1 : -1, colChange: 1 },
        'BL': { rowChange: currentPlayer === 'A' ? -1 : 1, colChange: -1 },
        'BR': { rowChange: currentPlayer === 'A' ? -1 : 1, colChange: 1 },
    };

    let steps = piece.includes('P') ? 1 : 2;
    let allowedDirections = piece.includes('P') ? ['L', 'R', 'F', 'B'] : piece.includes('H1') ? ['L', 'R', 'F', 'B'] : ['FL', 'FR', 'BL', 'BR'];

    if (!allowedDirections.includes(direction)) return;

    for (let i = 0; i < steps; i++) {
        newRow += movement[direction].rowChange;
        newCol += movement[direction].colChange;

        if (newRow < 0 || newRow >= boardSize || newCol < 0 || newCol >= boardSize) {
            return;
        }

        if (board[newRow][newCol] && board[newRow][newCol].startsWith(currentPlayer)) {
            return;
        }
    }

    const targetCell = board[newRow][newCol];
    if (targetCell && targetCell.startsWith(opponent())) {
        logMove(`${piece}:${direction} (Captured ${targetCell})`);
    } else {
        logMove(`${piece}:${direction}`);
    }

    board[row][col] = null;
    board[newRow][newCol] = piece;

    selectedCell = null;
    updateSelected();
    createBoard();
    checkWinCondition();
    changeTurn();

    socket.send(JSON.stringify({ action: 'update', data: { board, currentPlayer } }));
}

function changeTurn() {
    currentPlayer = opponent();
    if (!gameEnded) {
        document.title = `Current Player: ${currentPlayer}`;
    }
}

function opponent() {
    return currentPlayer === 'A' ? 'B' : 'A';
}

function logMove(move) {
    const moveElement = document.createElement('div');
    moveElement.innerText = move;
    historyElement.appendChild(moveElement);
}

function checkWinCondition() {
    const remainingOpponents = board.flat().filter(cell => cell && cell.startsWith(opponent()));
    if (remainingOpponents.length === 0) {
        gameEnded = true;
        winnerElement.innerText = `Player ${currentPlayer} wins!`;
        winnerElement.style.display = 'block';
        socket.send(JSON.stringify({ action: 'win', currentPlayer }));
    }
}

document.getElementById('L').onclick = () => movePiece('L');
document.getElementById('R').onclick = () => movePiece('R');
document.getElementById('F').onclick = () => movePiece('F');
document.getElementById('B').onclick = () => movePiece('B');
document.getElementById('FL').onclick = () => movePiece('FL');
document.getElementById('FR').onclick = () => movePiece('FR');
document.getElementById('BL').onclick = () => movePiece('BL');
document.getElementById('BR').onclick = () => movePiece('BR');

// Handle messages from the server
socket.onmessage = (event) => {
    const { action, data } = JSON.parse(event.data);
    if (action === 'update') {
        board = data.board;
        currentPlayer = data.currentPlayer;
        gameEnded = data.gameEnded || false; // reset gameEnded based on server data
        createBoard();
        updateSelected();
        if (currentPlayer === opponent()) {
            document.getElementById('status').innerText = `It's your turn, Player ${currentPlayer}`;
        } else {
            document.getElementById('status').innerText = `Waiting for Player ${opponent()} to make a move...`;
        }
    } else if (action === 'win') {
        gameEnded = true;
        winnerElement.innerText = `Player ${data.currentPlayer} wins!`;
        winnerElement.style.display = 'block';
        document.getElementById('status').innerText = `Player ${data.currentPlayer} wins!`;
    } else if (action === 'joined') {
        currentPlayer = data.playerId;
        document.getElementById('status').innerText = `You are Player ${currentPlayer}. Waiting for the opponent to join...`;
    } else if (action === 'start') {
        document.getElementById('status').innerText = data.message;
    } else if (action === 'full') {
        document.getElementById('status').innerText = data.message;
    }
};

// Initialize the game board
createBoard();
