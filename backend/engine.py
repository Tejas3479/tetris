import random
import copy

COLS, ROWS = 10, 20
SHAPES = {
    'I': [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    'J': [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    'L': [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    'O': [[1, 1], [1, 1]],
    'S': [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    'T': [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    'Z': [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
}

def rotate(shape):
    return [list(row) for row in zip(*shape[::-1])]

class HeuristicAnalyzer:
    @staticmethod
    def get_column_heights(grid):
        rows = len(grid)
        cols = len(grid[0])
        heights = [0] * cols
        for c in range(cols):
            for r in range(rows):
                if grid[r][c] != 0:
                    heights[c] = rows - r
                    break
        return heights

    @staticmethod
    def calculate_metrics(grid):
        heights = HeuristicAnalyzer.get_column_heights(grid)
        aggregate_height = sum(heights)
        
        holes = 0
        for c in range(len(grid[0])):
            block_found = False
            for r in range(len(grid)):
                if grid[r][c] != 0:
                    block_found = True
                elif block_found and grid[r][c] == 0:
                    holes += 1
        
        bumpiness = 0
        for i in range(len(heights) - 1):
            bumpiness += abs(heights[i] - heights[i+1])
            
        return {
            "aggregate_height": aggregate_height,
            "holes": holes,
            "bumpiness": bumpiness
        }

class AdversarialAgent:
    def __init__(self):
        self.pieces = ["I", "O", "T", "S", "Z", "J", "L"]
        self.reset()

    def reset(self):
        self.history = []
        self.chaos_meter = 0

    def simulate_placement(self, grid, piece_type):
        """Simulate all possible placements and return the 'best' score for the player."""
        shape = SHAPES[piece_type]
        best_player_score = float('inf')
        
        # Rotations (up to 4)
        current_shape = shape
        for _ in range(4):
            width = len(current_shape[0])
            for x in range(len(grid[0]) - width + 1):
                # Drop piece
                y = 0
                while self.is_valid(grid, current_shape, x, y + 1):
                    y += 1
                
                # Place piece
                temp_grid = [row[:] for row in grid]
                for r in range(len(current_shape)):
                    for c in range(len(current_shape[r])):
                        if current_shape[r][c]:
                            if y + r < ROWS:
                                temp_grid[y + r][x + c] = 1
                
                metrics = HeuristicAnalyzer.calculate_metrics(temp_grid)
                # Player tries to minimize this
                player_score = metrics["aggregate_height"] * 0.5 + metrics["holes"] * 4.0 + metrics["bumpiness"] * 1.0
                if player_score < best_player_score:
                    best_player_score = player_score
            
            current_shape = rotate(current_shape)
            if current_shape == shape: break # Optimization for symmetric pieces

        return best_player_score

    def is_valid(self, grid, shape, x, y):
        for r in range(len(shape)):
            for c in range(len(shape[r])):
                if shape[r][c]:
                    if y + r >= len(grid) or x + c < 0 or x + c >= len(grid[0]) or grid[y + r][x + c]:
                        return False
        return True

    def decide_next_piece(self, board):
        metrics = HeuristicAnalyzer.calculate_metrics(board)
        
        # Piece History tracking
        piece_counts = {p: self.history.count(p) for p in self.pieces}

        # Mercy Metric
        is_mercy = False
        if metrics["aggregate_height"] > 15 * len(board[0]):
            if random.random() < 0.3:
                is_mercy = True

        best_adversarial_piece = "I" if is_mercy else "T"
        max_min_score = -float('inf')

        if not is_mercy:
            for piece in self.pieces:
                # We want the piece where the player's 'best' move still results in high entropy
                score = self.simulate_placement(board, piece)
                
                # Starvation Multiplier: If player hasn't seen this piece, and it's GOOD for them (low score),
                # we are MORE likely to withhold it.
                starvation_mult = 1.0
                if piece_counts.get(piece, 0) == 0:
                    if score < 15: # If it's a helpful piece
                        starvation_mult = 1.6 # Heavier suppression

                weighted_score = score * starvation_mult

                if weighted_score > max_min_score:
                    max_min_score = weighted_score
                    best_adversarial_piece = piece
        else:
            max_min_score = 0 # Lower chaos when mercy is active

        # Update History
        self.history.append(best_adversarial_piece)
        if len(self.history) > 12:
            self.history.pop(0)

        # Generate thoughts
        thoughts = [
            f"Analyzing weakness in Column {random.randint(0, 9)}...",
            f"Withholding critical assets. Deploying {best_adversarial_piece}.",
            "Heuristic thresholds exceeded. Chaos imminent.",
            "Calculating optimal disruption vectors...",
            "Visualizing your failure. Convergence complete.",
            f"Entropy Check: {metrics['holes']} system vulnerabilities."
        ]
        if is_mercy:
            thoughts = ["Mercy protocol active. For now...", "Providing structural stability."]

        # Normalize score for chaos meter (0-100)
        chaos_meter = min(100, int((max_min_score / 60.0) * 100))

        return {
            "piece": best_adversarial_piece,
            "chaos": chaos_meter,
            "thought": random.choice(thoughts)
        }

class GameEngine:
    def __init__(self, width=10, height=20):
        self.width = width
        self.height = height
        self.grid = [[0 for _ in range(width)] for _ in range(height)]
        self.agent = AdversarialAgent()
        self.locked_cell = None # (y, x)

    def reset(self):
        self.grid = [[0 for _ in range(self.width)] for _ in range(self.height)]
        self.locked_cell = None
        self.agent.reset()

    def update_board(self, board):
        if len(board) == self.height and len(board[0]) == self.width:
            self.grid = board
        else:
            print(f"Warning: Invalid board dimensions received: {len(board)}x{len(board[0]) if board else 0}")

    def get_next_piece(self):
        return self.agent.decide_next_piece(self.grid)

    def generate_lock(self):
        empty_cells = []
        for r in range(self.height):
            for c in range(self.width):
                if self.grid[r][c] == 0:
                    empty_cells.append((r, c))
        
        if empty_cells:
            self.locked_cell = random.choice(empty_cells)
            return self.locked_cell
        return None

    def clear_lock(self):
        self.locked_cell = None
