// Chess piece Unicode characters
const PIECES = {
    white: {
        king: '♔',
        queen: '♕',
        rook: '♖',
        bishop: '♗',
        knight: '♘',
        pawn: '♙'
    },
    black: {
        king: '♚',
        queen: '♛',
        rook: '♜',
        bishop: '♝',
        knight: '♞',
        pawn: '♟'
    }
};

// Game state
let board = [];
let selectedSquare = null;
let currentTurn = 'white';
let moveHistory = [];
let capturedPieces = { white: [], black: [] };
let enPassantTarget = null;
let castlingRights = {
    white: { kingSide: true, queenSide: true },
    black: { kingSide: true, queenSide: true }
};
let kingPositions = { white: null, black: null };
let isCheck = false;
let isCheckmate = false;
let isStalemate = false;

// Initialize the board with starting positions
function initializeBoard() {
    board = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Black pieces (top)
    board[0] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'].map(piece => ({ type: piece, color: 'black' }));
    board[1] = Array(8).fill(null).map(() => ({ type: 'pawn', color: 'black' }));
    
    // White pieces (bottom)
    board[6] = Array(8).fill(null).map(() => ({ type: 'pawn', color: 'white' }));
    board[7] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'].map(piece => ({ type: piece, color: 'white' }));
    
    // Track king positions
    kingPositions = { white: { row: 7, col: 4 }, black: { row: 0, col: 4 } };
}

// Create the visual board
function createBoard() {
    const chessboard = document.getElementById('chessboard');
    if (!chessboard) {
        console.error('Chessboard element not found!');
        return;
    }
    
    chessboard.innerHTML = '';

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((row + col) % 2 === 0 ? 'light' : 'dark');
            square.dataset.row = row;
            square.dataset.col = col;
            
            const piece = board[row][col];
            if (piece) {
                square.textContent = PIECES[piece.color][piece.type];
                square.dataset.piece = piece.type;
                square.dataset.color = piece.color;
            }
            
            square.addEventListener('click', () => handleSquareClick(row, col));
            chessboard.appendChild(square);
        }
    }
}

// Safe element getter with fallback
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with id '${id}' not found`);
    }
    return element;
}

// Handle square clicks
function handleSquareClick(row, col) {
    if (isCheckmate || isStalemate) return;
    
    const square = board[row][col];
    
    if (selectedSquare) {
        const validMoves = getValidMoves(selectedSquare.row, selectedSquare.col);
        const isValid = validMoves.some(move => move.row === row && move.col === col);
        
        if (isValid) {
            makeMove(selectedSquare.row, selectedSquare.col, row, col);
            clearSelection();
            switchTurn();
            checkGameState();
            updateDisplay();
        } else {
            clearSelection();
            if (square && square.color === currentTurn) {
                selectSquare(row, col);
            }
        }
    } else {
        if (square && square.color === currentTurn) {
            selectSquare(row, col);
        }
    }
}

// Select a square
function selectSquare(row, col) {
    selectedSquare = { row, col };
    highlightValidMoves(row, col);
    
    const squares = document.querySelectorAll('.square');
    squares.forEach(sq => {
        if (parseInt(sq.dataset.row) === row && parseInt(sq.dataset.col) === col) {
            sq.classList.add('selected');
        }
    });
}

// Clear selection
function clearSelection() {
    selectedSquare = null;
    const squares = document.querySelectorAll('.square');
    squares.forEach(sq => {
        sq.classList.remove('selected', 'valid-move', 'has-piece');
    });
}

// Highlight valid moves
function highlightValidMoves(row, col) {
    const squares = document.querySelectorAll('.square');
    const validMoves = getValidMoves(row, col);
    
    squares.forEach(sq => {
        const targetRow = parseInt(sq.dataset.row);
        const targetCol = parseInt(sq.dataset.col);
        if (validMoves.some(move => move.row === targetRow && move.col === targetCol)) {
            sq.classList.add('valid-move');
            if (board[targetRow][targetCol]) {
                sq.classList.add('has-piece');
            }
        }
    });
}

// Get valid moves (legal moves that don't leave king in check)
function getValidMoves(row, col) {
    const moves = getPseudoLegalMoves(row, col);
    const piece = board[row][col];
    if (!piece) return [];
    
    return moves.filter(move => {
        const originalBoard = JSON.parse(JSON.stringify(board));
        const originalKingPos = JSON.parse(JSON.stringify(kingPositions));
        
        board[move.row][move.col] = piece;
        board[row][col] = null;
        
        if (piece.type === 'king') {
            kingPositions[piece.color] = { row: move.row, col: move.col };
        }
        
        const inCheck = isKingInCheck(piece.color);
        
        board = originalBoard;
        kingPositions = originalKingPos;
        
        return !inCheck;
    });
}

// Get pseudo-legal moves (now with flag to prevent recursion)
function getPseudoLegalMoves(row, col, includeCastling = true) {
    const piece = board[row][col];
    if (!piece) return [];
    
    switch (piece.type) {
        case 'pawn': return getPawnMoves(row, col, piece.color);
        case 'rook': return getRookMoves(row, col, piece.color);
        case 'knight': return getKnightMoves(row, col, piece.color);
        case 'bishop': return getBishopMoves(row, col, piece.color);
        case 'queen': return getQueenMoves(row, col, piece.color);
        case 'king': return getKingMoves(row, col, piece.color, includeCastling);
        default: return [];
    }
}

// Pawn moves (including en passant)
function getPawnMoves(row, col, color) {
    const moves = [];
    const direction = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;
    
    if (isValidSquare(row + direction, col) && !board[row + direction][col]) {
        moves.push({ row: row + direction, col });
        
        if (row === startRow && !board[row + 2 * direction][col]) {
            moves.push({ row: row + 2 * direction, col });
        }
    }
    
    for (const colOffset of [-1, 1]) {
        const newRow = row + direction;
        const newCol = col + colOffset;
        if (isValidSquare(newRow, newCol)) {
            const targetPiece = board[newRow][newCol];
            if (targetPiece && targetPiece.color !== color) {
                moves.push({ row: newRow, col: newCol });
            }
            
            if (enPassantTarget && 
                newRow === enPassantTarget.row && 
                newCol === enPassantTarget.col) {
                moves.push({ row: newRow, col: newCol });
            }
        }
    }
    
    return moves;
}

// Rook moves
function getRookMoves(row, col, color) {
    const moves = [];
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    
    for (const [dr, dc] of directions) {
        let newRow = row + dr;
        let newCol = col + dc;
        
        while (isValidSquare(newRow, newCol)) {
            const targetPiece = board[newRow][newCol];
            if (!targetPiece) {
                moves.push({ row: newRow, col: newCol });
            } else {
                if (targetPiece.color !== color) {
                    moves.push({ row: newRow, col: newCol });
                }
                break;
            }
            newRow += dr;
            newCol += dc;
        }
    }
    
    return moves;
}

// Knight moves
function getKnightMoves(row, col, color) {
    const moves = [];
    const offsets = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    
    for (const [dr, dc] of offsets) {
        const newRow = row + dr;
        const newCol = col + dc;
        
        if (isValidSquare(newRow, newCol)) {
            const targetPiece = board[newRow][newCol];
            if (!targetPiece || targetPiece.color !== color) {
                moves.push({ row: newRow, col: newCol });
            }
        }
    }
    
    return moves;
}

// Bishop moves
function getBishopMoves(row, col, color) {
    const moves = [];
    const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    
    for (const [dr, dc] of directions) {
        let newRow = row + dr;
        let newCol = col + dc;
        
        while (isValidSquare(newRow, newCol)) {
            const targetPiece = board[newRow][newCol];
            if (!targetPiece) {
                moves.push({ row: newRow, col: newCol });
            } else {
                if (targetPiece.color !== color) {
                    moves.push({ row: newRow, col: newCol });
                }
                break;
            }
            newRow += dr;
            newCol += dc;
        }
    }
    
    return moves;
}

// Queen moves
function getQueenMoves(row, col, color) {
    return [...getRookMoves(row, col, color), ...getBishopMoves(row, col, color)];
}

// King moves (including castling) - FIX: Added includeCastling parameter
function getKingMoves(row, col, color, includeCastling = true) {
    const moves = [];
    const offsets = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1]
    ];
    
    for (const [dr, dc] of offsets) {
        const newRow = row + dr;
        const newCol = col + dc;
        
        if (isValidSquare(newRow, newCol)) {
            const targetPiece = board[newRow][newCol];
            if (!targetPiece || targetPiece.color !== color) {
                moves.push({ row: newRow, col: newCol });
            }
        }
    }
    
    // Only check castling if we're not in a recursive call
    if (includeCastling && !isKingInCheck(color)) {
        // Kingside castling
        if (castlingRights[color].kingSide) {
            if (!board[row][col + 1] && !board[row][col + 2] &&
                !isSquareAttacked(row, col + 1, color) && !isSquareAttacked(row, col + 2, color)) {
                moves.push({ row, col: col + 2 });
            }
        }
        
        // Queenside castling
        if (castlingRights[color].queenSide) {
            if (!board[row][col - 1] && !board[row][col - 2] && !board[row][col - 3] &&
                !isSquareAttacked(row, col - 1, color) && !isSquareAttacked(row, col - 2, color)) {
                moves.push({ row, col: col - 2 });
            }
        }
    }
    
    return moves;
}

function isValidSquare(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function isKingInCheck(color) {
    const kingPos = kingPositions[color];
    if (!kingPos) return false;
    
    return isSquareAttacked(kingPos.row, kingPos.col, color);
}

// FIX: Pass includeCastling=false to prevent recursion
function isSquareAttacked(row, col, defendingColor) {
    const attackingColor = defendingColor === 'white' ? 'black' : 'white';
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === attackingColor) {
                // Don't check castling when checking for attacks (prevents recursion)
                const moves = getPseudoLegalMoves(r, c, false);
                if (moves.some(move => move.row === row && move.col === col)) {
                    return true;
                }
            }
        }
    }
    return false;
}

function checkGameState() {
    const inCheck = isKingInCheck(currentTurn);
    isCheck = inCheck;
    
    const hasLegalMoves = playerHasLegalMoves(currentTurn);
    
    if (!hasLegalMoves) {
        if (inCheck) {
            isCheckmate = true;
        } else {
            isStalemate = true;
        }
    }
    
    updateGameInfo();
}

function playerHasLegalMoves(color) {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.color === color) {
                const validMoves = getValidMoves(row, col);
                if (validMoves.length > 0) {
                    return true;
                }
            }
        }
    }
    return false;
}

function makeMove(fromRow, fromCol, toRow, toCol) {
    const piece = board[fromRow][fromCol];
    const capturedPiece = board[toRow][toCol];
    
    const move = {
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
        piece: piece,
        captured: capturedPiece,
        enPassantTarget: enPassantTarget,
        castlingRights: JSON.parse(JSON.stringify(castlingRights))
    };
    
    if (piece.type === 'pawn' && enPassantTarget && 
        toRow === enPassantTarget.row && toCol === enPassantTarget.col) {
        const captureRow = piece.color === 'white' ? toRow + 1 : toRow - 1;
        const capturedPawn = board[captureRow][toCol];
        board[captureRow][toCol] = null;
        move.captured = capturedPawn;
        move.enPassant = true;
        if (capturedPawn) {
            capturedPieces[capturedPawn.color].push(capturedPawn.type);
        }
    }
    
    if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
        const isKingSide = toCol > fromCol;
        const rookFromCol = isKingSide ? 7 : 0;
        const rookToCol = isKingSide ? toCol - 1 : toCol + 1;
        
        board[toRow][rookToCol] = board[toRow][rookFromCol];
        board[toRow][rookFromCol] = null;
        move.castling = isKingSide ? 'kingside' : 'queenside';
    }
    
    if (capturedPiece && !move.enPassant) {
        capturedPieces[capturedPiece.color].push(capturedPiece.type);
    }
    
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = null;
    
    if (piece.type === 'king') {
        kingPositions[piece.color] = { row: toRow, col: toCol };
    }
    
    if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
        board[toRow][toCol] = { type: 'queen', color: piece.color };
        move.promotion = true;
    }
    
    updateCastlingRights(piece, fromRow, fromCol);
    
    enPassantTarget = null;
    if (piece.type === 'pawn' && Math.abs(toRow - fromRow) === 2) {
        enPassantTarget = {
            row: piece.color === 'white' ? fromRow - 1 : fromRow + 1,
            col: fromCol
        };
    }
    
    moveHistory.push(move);
    
    updateCapturedPieces();
    updateMoveHistory();
}

function updateCastlingRights(piece, row, col) {
    const color = piece.color;
    
    if (piece.type === 'king') {
        castlingRights[color].kingSide = false;
        castlingRights[color].queenSide = false;
    } else if (piece.type === 'rook') {
        if (color === 'white' && row === 7) {
            if (col === 0) castlingRights.white.queenSide = false;
            if (col === 7) castlingRights.white.kingSide = false;
        } else if (color === 'black' && row === 0) {
            if (col === 0) castlingRights.black.queenSide = false;
            if (col === 7) castlingRights.black.kingSide = false;
        }
    }
}

function formatMoveNotation(move) {
    if (move.castling) {
        return move.castling === 'kingside' ? 'O-O' : 'O-O-O';
    }
    
    const piece = move.piece.type;
    const from = String.fromCharCode(97 + move.from.col) + (8 - move.from.row);
    const to = String.fromCharCode(97 + move.to.col) + (8 - move.to.row);
    const capture = move.captured ? 'x' : '-';
    const pieceSymbol = piece === 'pawn' ? '' : piece.charAt(0).toUpperCase();
    
    return `${pieceSymbol}${from}${capture}${to}`;
}

function switchTurn() {
    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    const turnElement = getElement('current-turn');
    if (turnElement) {
        turnElement.textContent = currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1);
    }
}

function updateGameInfo() {
    const statusElement = getElement('status-message');
    if (!statusElement) return;
    
    if (isCheckmate) {
        const winner = currentTurn === 'white' ? 'Black' : 'White';
        statusElement.textContent = `Checkmate! ${winner} wins!`;
        statusElement.className = 'status-message check';
    } else if (isStalemate) {
        statusElement.textContent = 'Stalemate! Game is a draw.';
        statusElement.className = 'status-message';
    } else if (isCheck) {
        statusElement.textContent = 'Check!';
        statusElement.className = 'status-message check';
    } else {
        statusElement.textContent = 'Make your move';
        statusElement.className = 'status-message';
    }
}

function updateCapturedPieces() {
    const whiteElement = getElement('white-captured');
    const blackElement = getElement('black-captured');
    
    if (whiteElement) {
        whiteElement.innerHTML = capturedPieces.white.map(p => 
            `<span class="captured-piece">${PIECES.white[p]}</span>`
        ).join('');
    }
    
    if (blackElement) {
        blackElement.innerHTML = capturedPieces.black.map(p => 
            `<span class="captured-piece">${PIECES.black[p]}</span>`
        ).join('');
    }
}

function updateMoveHistory() {
    const historyDiv = getElement('move-history');
    if (!historyDiv) return;
    
    historyDiv.innerHTML = '';
    
    for (let i = 0; i < moveHistory.length; i += 2) {
        const whiteMove = moveHistory[i];
        const blackMove = moveHistory[i + 1];
        
        const moveItem = document.createElement('div');
        moveItem.className = 'move-history-item';
        
        const moveNumber = document.createElement('span');
        moveNumber.className = 'move-number';
        moveNumber.textContent = `${Math.floor(i / 2) + 1}.`;
        
        const whiteMoveText = document.createElement('span');
        whiteMoveText.textContent = formatMoveNotation(whiteMove);
        
        moveItem.appendChild(moveNumber);
        moveItem.appendChild(whiteMoveText);
        
        if (blackMove) {
            const blackMoveText = document.createElement('span');
            blackMoveText.textContent = formatMoveNotation(blackMove);
            moveItem.appendChild(blackMoveText);
        }
        
        historyDiv.appendChild(moveItem);
    }
    
    historyDiv.scrollTop = historyDiv.scrollHeight;
}

function updateDisplay() {
    createBoard();
    updateCapturedPieces();
    updateMoveHistory();
    updateGameInfo();
}

function undoMove() {
    if (moveHistory.length === 0) return;
    
    const lastMove = moveHistory.pop();
    
    board[lastMove.from.row][lastMove.from.col] = lastMove.piece;
    board[lastMove.to.row][lastMove.to.col] = lastMove.captured || null;
    
    if (lastMove.enPassant) {
        const color = lastMove.piece.color;
        const captureRow = color === 'white' ? lastMove.to.row + 1 : lastMove.to.row - 1;
        board[captureRow][lastMove.to.col] = lastMove.captured;
        board[lastMove.to.row][lastMove.to.col] = null;
    }
    
    if (lastMove.castling) {
        const isKingSide = lastMove.castling === 'kingside';
        const rookFromCol = isKingSide ? lastMove.to.col - 1 : lastMove.to.col + 1;
        const rookToCol = isKingSide ? 7 : 0;
        
        board[lastMove.to.row][rookToCol] = board[lastMove.to.row][rookFromCol];
        board[lastMove.to.row][rookFromCol] = null;
    }
    
    if (lastMove.promotion) {
        board[lastMove.from.row][lastMove.from.col] = { type: 'pawn', color: lastMove.piece.color };
    }
    
    if (lastMove.piece.type === 'king') {
        kingPositions[lastMove.piece.color] = lastMove.from;
    }
    
    enPassantTarget = lastMove.enPassantTarget;
    castlingRights = lastMove.castlingRights;
    
    if (lastMove.captured) {
        const capturedColor = lastMove.captured.color;
        const index = capturedPieces[capturedColor].lastIndexOf(lastMove.captured.type);
        if (index > -1) {
            capturedPieces[capturedColor].splice(index, 1);
        }
    }
    
    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    const turnElement = getElement('current-turn');
    if (turnElement) {
        turnElement.textContent = currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1);
    }
    
    isCheck = false;
    isCheckmate = false;
    isStalemate = false;
    
    updateDisplay();
}

function resetGame() {
    initializeBoard();
    selectedSquare = null;
    currentTurn = 'white';
    moveHistory = [];
    capturedPieces = { white: [], black: [] };
    enPassantTarget = null;
    castlingRights = {
        white: { kingSide: true, queenSide: true },
        black: { kingSide: true, queenSide: true }
    };
    isCheck = false;
    isCheckmate = false;
    isStalemate = false;
    
    const turnElement = getElement('current-turn');
    if (turnElement) {
        turnElement.textContent = 'White';
    }
    
    updateDisplay();
}

// Event listeners
const newGameBtn = getElement('new-game-btn');
if (newGameBtn) {
    newGameBtn.addEventListener('click', resetGame);
}

const undoBtn = getElement('undo-btn');
if (undoBtn) {
    undoBtn.addEventListener('click', undoMove);
}

// Initialize game on load
window.addEventListener('DOMContentLoaded', () => {
    initializeBoard();
    createBoard();
    updateGameInfo();
});

// Also try immediate initialization in case DOMContentLoaded already fired
if (document.readyState === 'loading') {
    // Still loading
} else {
    // DOM is already ready
    initializeBoard();
    createBoard();
    updateGameInfo();
}

// ============================================
// AI INTEGRATION PLACEHOLDER
// ============================================
// To integrate your chess AI, implement the following function:
//
// function makeAIMove() {
//     // 1. Get all legal moves for the current player (black/AI)
//     const allMoves = [];
//     for (let row = 0; row < 8; row++) {
//         for (let col = 0; col < 8; col++) {
//             const piece = board[row][col];
//             if (piece && piece.color === currentTurn) {
//                 const moves = getValidMoves(row, col);
//                 moves.forEach(move => {
//                     allMoves.push({ from: { row, col }, to: move });
//                 });
//             }
//         }
//     }
//     
//     // 2. Evaluate positions using your chess engine
//     // 3. Select the best move
//     // 4. Execute: makeMove(bestMove.from.row, bestMove.from.col, bestMove.to.row, bestMove.to.col)
// }
//
// Then call makeAIMove() after each player move when it's the AI's turn
// ============================================
