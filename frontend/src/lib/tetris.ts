export type PieceType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z' | 'entropy';

export interface Point {
  x: number;
  y: number;
}

export interface Piece {
  type: PieceType;
  position: Point;
  rotation: number; // 0, 1, 2, 3
  shape: number[][];
}

export const COLS = 10;
export const ROWS = 20;
export const INITIAL_DROP_INTERVAL = 1000;
export const MIN_DROP_INTERVAL = 100;
export const SPEED_INCREMENT = 0.95;

export const SHAPES: Record<PieceType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  entropy: [[1]],
};

export const COLORS: Record<PieceType | 'empty' | 'ghost', string> = {
  I: '#00f0f0',
  J: '#0000f0',
  L: '#f0a000',
  O: '#f0f000',
  S: '#00f000',
  T: '#a000f0',
  Z: '#f00000',
  empty: '#111827',
  ghost: 'rgba(255, 255, 255, 0.2)',
  entropy: '#4b5563',
};

// SRS Wall Kick Data
// 0: 0 deg, 1: 90 deg clockwise, 2: 180 deg, 3: 270 deg clockwise
const WALL_KICKS_NORMAL = {
  '0-1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1-0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1-2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2-1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2-3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3-2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3-0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0-3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

const WALL_KICKS_I = {
  '0-1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1-0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1-2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2-1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2-3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3-2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3-0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0-3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

export function rotate(matrix: number[][]): number[][] {
  const n = matrix.length;
  const res = matrix.map((row) => [...row]);
  for (let i = 0; i < n / 2; i++) {
    for (let j = i; j < n - i - 1; j++) {
      const temp = res[i][j];
      res[i][j] = res[n - 1 - j][i];
      res[n - 1 - j][i] = res[n - 1 - i][n - 1 - j];
      res[n - 1 - i][n - 1 - j] = res[j][n - 1 - i];
      res[j][n - 1 - i] = temp;
    }
  }
  return res;
}

export function isValidMove(grid: (PieceType | number)[][], piece: Piece, offset: Point = { x: 0, y: 0 }, lockedCell: Point | null = null): boolean {
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const newX = piece.position.x + x + offset.x;
        const newY = piece.position.y + y + offset.y;
        
        // Check grid boundaries
        if (newX < 0 || newX >= COLS || newY >= ROWS) return false;
        
        // Check collision with locked cell
        if (lockedCell && newX === lockedCell.x && newY === lockedCell.y) return false;
        
        // Check collision with other blocks
        if (newY >= 0 && grid[newY][newX]) return false;
      }
    }
  }
  return true;
}

export function getWallKicks(type: PieceType, fromRot: number, toRot: number) {
  const key = `${fromRot}-${toRot}` as keyof typeof WALL_KICKS_NORMAL;
  if (type === 'I') return WALL_KICKS_I[key];
  if (type === 'O') return [[0, 0]];
  return WALL_KICKS_NORMAL[key];
}
