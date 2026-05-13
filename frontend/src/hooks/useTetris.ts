import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Piece, PieceType, Point, SHAPES, COLS, ROWS, 
  isValidMove, rotate, getWallKicks, 
  INITIAL_DROP_INTERVAL, MIN_DROP_INTERVAL, SPEED_INCREMENT 
} from '../lib/tetris';

const INITIAL_GRID = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

export const useTetris = () => {
  const [grid, setGrid] = useState<(PieceType | number)[][]>(INITIAL_GRID);
  const [activePiece, setActivePiece] = useState<Piece | null>(null);
  const [nextPieceType, setNextPieceType] = useState<PieceType>('I'); // Fixed initial for SSR
  const [holdPiece, setHoldPiece] = useState<PieceType | null>(null);
  const [canHold, setCanHold] = useState(true);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [chaos, setChaos] = useState(0);
  const [thoughts, setThoughts] = useState<{text: string, time: string}[]>([
    { text: "SYSTEM_READY", time: "00:00:00" } // Fixed initial for SSR
  ]);
  const [lockedCell, setLockedCell] = useState<Point | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const dropCounterRef = useRef<number>(0);
  const [dropInterval, setDropInterval] = useState(INITIAL_DROP_INTERVAL);

  // Initialize client-side state
  useEffect(() => {
    setNextPieceType(getRandomPieceType());
    setThoughts([{ text: "SYSTEM_READY", time: new Date().toLocaleTimeString() }]);
  }, []);

  // WebSocket Setup with Reconnection
  useEffect(() => {
    let socket: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;
    let isComponentMounted = true;

    const connect = () => {
      if (!isComponentMounted) return;
      
      socket = new WebSocket('ws://localhost:8000/ws');
      socket.onopen = () => {
        if (isComponentMounted) {
          console.log('WebSocket Connected');
          setThoughts(prev => [{ text: "WEBSOCKET_ESTABLISHED", time: new Date().toLocaleTimeString() }, ...prev].slice(0, 10));
        }
      };
      socket.onmessage = (event) => {
        if (!isComponentMounted) return;
        const data = JSON.parse(event.data);
        if (data.type === 'ADVERSARIAL_UPDATE') {
          const { piece, chaos: newChaos, thought } = data.payload;
          setNextPieceType(piece as PieceType);
          setChaos(newChaos);
          setThoughts(prev => [{ text: thought, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 10));
        } else if (data.type === 'CELL_LOCK') {
          setLockedCell(data.payload);
        } else if (data.type === 'CLEAR_LOCK') {
          setLockedCell(null);
        }
      };
      socket.onclose = () => {
        if (isComponentMounted) {
          console.log('WebSocket Disconnected. Reconnecting...');
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
      setWs(socket);
    };

    connect();
    return () => {
      isComponentMounted = false;
      socket?.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  function getRandomPieceType(): PieceType {
    const pieces: PieceType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
    return pieces[Math.floor(Math.random() * pieces.length)];
  }

  const spawnPiece = useCallback((type: PieceType) => {
    const shape = SHAPES[type];
    const piece: Piece = {
      type,
      position: { x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: -1 },
      rotation: 0,
      shape: shape.map(row => [...row]),
    };

    if (!isValidMove(grid, piece, { x: 0, y: 0 }, lockedCell)) {
      setGameOver(true);
      setIsPaused(true);
      return;
    }
    setActivePiece(piece);
    setCanHold(true);
  }, [grid, lockedCell]);

  const togglePause = useCallback(() => {
    if (gameOver) {
      // Reset game
      setGrid(INITIAL_GRID);
      setScore(0);
      setGameOver(false);
      setChaos(0);
      setDropInterval(INITIAL_DROP_INTERVAL);
      setActivePiece(null);
      setHoldPiece(null);
      setCanHold(true);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'RESET_GAME' }));
      }
    }
    
    setIsPaused(prev => {
      if (prev === true) { // Transitioning from paused to unpaused
        lastTimeRef.current = performance.now();
      }
      return !prev;
    });
  }, [gameOver, ws]);

  useEffect(() => {
    if (!activePiece && !gameOver && !isPaused) {
      spawnPiece(nextPieceType);
    }
  }, [activePiece, gameOver, isPaused, nextPieceType, spawnPiece]);

  const hold = useCallback(() => {
    if (!activePiece || !canHold || isPaused) return;

    const currentType = activePiece.type;
    if (holdPiece) {
      spawnPiece(holdPiece);
    } else {
      setActivePiece(null);
    }
    setHoldPiece(currentType);
    setCanHold(false);
  }, [activePiece, canHold, holdPiece, isPaused, spawnPiece]);

  const lockPiece = useCallback((piece: Piece) => {
    const newGrid = grid.map(row => [...row]);
    piece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          const gridY = piece.position.y + y;
          const gridX = piece.position.x + x;
          if (gridY >= 0) newGrid[gridY][gridX] = piece.type; // Store the actual type
        }
      });
    });

    const rowsToClear = newGrid
      .map((row, i) => (row.every(cell => cell !== 0) ? i : -1))
      .filter(i => i !== -1);

    let cleared = rowsToClear.length;
    let finalGrid = [...newGrid];

    let purgeTriggered = false;
    let newLockedCell = lockedCell;

    if (lockedCell && rowsToClear.includes(lockedCell.y)) {
      purgeTriggered = true;
      newLockedCell = null;
      setChaos(0);
      setThoughts(prev => [{ text: "PURGE_PROTOCOL_SUCCESS: Malice neutralized.", time: new Date().toLocaleTimeString() }, ...prev].slice(0, 10));
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'PURGE_EVENT' }));
      }
    } else if (lockedCell && cleared > 0) {
      // Translate lock: Shift down if lines above were cleared
      const rowsBelow = rowsToClear.filter(y => y > lockedCell.y).length;
      const rowsAbove = rowsToClear.filter(y => y < lockedCell.y).length;
      // Note: Since we shift top-down by unshifting zeros, 
      // the lock effectively moves DOWN by the number of rows cleared ABOVE it.
      newLockedCell = { ...lockedCell, y: lockedCell.y + rowsAbove };
    }

    if (cleared > 0) {
      finalGrid = newGrid.filter(row => !row.every(cell => cell !== 0));
      while (finalGrid.length < ROWS) {
        finalGrid.unshift(Array(COLS).fill(0));
      }

      if (!purgeTriggered && Math.random() < 0.15) {
         const randomRow = Math.floor(Math.random() * (ROWS - 5)) + 5;
         const randomCol = Math.floor(Math.random() * COLS);
         finalGrid[randomRow][randomCol] = 'entropy';
      }
      
      // Speed increase
      setDropInterval((prev: number) => Math.max(MIN_DROP_INTERVAL, prev * SPEED_INCREMENT));
    }

    setGrid(finalGrid);
    setLockedCell(newLockedCell);
    setScore(prev => prev + cleared * 100);
    setActivePiece(null);

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'BOARD_STATE', payload: finalGrid }));
    }
  }, [grid, ws, lockedCell]);

  const movePiece = useCallback((dx: number, dy: number) => {
    if (!activePiece || gameOver || isPaused) return false;
    if (isValidMove(grid, activePiece, { x: dx, y: dy }, lockedCell)) {
      setActivePiece(prev => prev ? { ...prev, position: { x: prev.position.x + dx, y: prev.position.y + dy } } : null);
      return true;
    }
    if (dy > 0) {
      lockPiece(activePiece);
    }
    return false;
  }, [activePiece, grid, gameOver, isPaused, lockPiece, lockedCell]);

  const rotatePiece = useCallback(() => {
    if (!activePiece || gameOver || isPaused) return;
    const nextRotation = (activePiece.rotation + 1) % 4;
    const nextShape = rotate(activePiece.shape);
    const kicks = getWallKicks(activePiece.type, activePiece.rotation, nextRotation);

    for (const [kx, ky] of kicks) {
      const rotatedPiece: Piece = {
        ...activePiece,
        rotation: nextRotation,
        shape: nextShape,
        position: { x: activePiece.position.x + kx, y: activePiece.position.y - ky }
      };
      if (isValidMove(grid, rotatedPiece, { x: 0, y: 0 }, lockedCell)) {
        setActivePiece(rotatedPiece);
        return;
      }
    }
  }, [activePiece, grid, gameOver, isPaused, lockedCell]);

  const hardDrop = useCallback(() => {
    if (!activePiece || gameOver || isPaused) return;
    let dropY = 0;
    while (isValidMove(grid, activePiece, { x: 0, y: dropY + 1 }, lockedCell)) {
      dropY++;
    }
    const finalPiece = { ...activePiece, position: { ...activePiece.position, y: activePiece.position.y + dropY } };
    lockPiece(finalPiece);
  }, [activePiece, grid, gameOver, isPaused, lockPiece, lockedCell]);

  const getGhostPosition = useCallback((): Point | null => {
    if (!activePiece) return null;
    let dropY = 0;
    while (isValidMove(grid, activePiece, { x: 0, y: dropY + 1 }, lockedCell)) {
      dropY++;
    }
    return { x: activePiece.position.x, y: activePiece.position.y + dropY };
  }, [activePiece, grid, lockedCell]);

  // Real-time position pulse to backend
  useEffect(() => {
    if (!activePiece || isPaused || !ws || ws.readyState !== WebSocket.OPEN) return;
    
    const interval = setInterval(() => {
      ws.send(JSON.stringify({
        type: 'LIVE_UPDATE',
        payload: { x: activePiece.position.x, y: activePiece.position.y }
      }));
    }, 500);

    return () => clearInterval(interval);
  }, [activePiece, isPaused, ws]);

  const update = useCallback((time: number) => {
    if (isPaused) return;
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    dropCounterRef.current += deltaTime;
    if (dropCounterRef.current > dropInterval) {
      movePiece(0, 1);
      dropCounterRef.current = 0;
    }

    requestRef.current = requestAnimationFrame(update);
  }, [movePiece, isPaused, dropInterval]);

  useEffect(() => {
    if (!isPaused) {
      requestRef.current = requestAnimationFrame(update);
    }
    return () => cancelAnimationFrame(requestRef.current!);
  }, [update, isPaused]);

  return {
    grid, activePiece, ghostPosition: getGhostPosition(),
    nextPieceType, holdPiece, score, gameOver, isPaused, chaos, thoughts, lockedCell,
    movePiece, rotatePiece, hardDrop, hold, togglePause
  };
};
