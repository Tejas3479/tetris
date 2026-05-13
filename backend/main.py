from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from engine import GameEngine
import json

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Entropic Tetris Backend"}

import asyncio

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    engine = GameEngine()
    
    # Managed predictive lock state
    lock_id = 0
    last_active_pos = {"x": 5, "y": 0}

    async def shadow_agent_loop():
        try:
            while True:
                await asyncio.sleep(8)
                # Smarter Sabotage: Pick a cell near where the player last was
                target_y = min(19, max(0, last_active_pos["y"] + random.randint(1, 3)))
                target_x = min(9, max(0, last_active_pos["x"] + random.randint(-1, 1)))
                
                if engine.grid[target_y][target_x] == 0:
                    engine.locked_cell = (target_y, target_x)
                    await websocket.send_json({
                        "type": "CELL_LOCK",
                        "payload": {"y": target_y, "x": target_x}
                    })
                    await asyncio.sleep(4)
                    engine.clear_lock()
                    await websocket.send_json({"type": "CLEAR_LOCK"})
        except Exception as e:
            print(f"Shadow Agent error: {e}")

    # Start shadow agent in background
    shadow_task = asyncio.create_task(shadow_agent_loop())

    # Managed predictive lock state
    lock_id = 0

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "BOARD_STATE":
                board = message["payload"]
                engine.update_board(board)
                adversarial_data = engine.get_next_piece()
                await websocket.send_json({
                    "type": "ADVERSARIAL_UPDATE",
                    "payload": adversarial_data
                })
            elif message["type"] == "PURGE_EVENT":
                engine.clear_lock()
                await websocket.send_json({"type": "CLEAR_LOCK"})
            elif message["type"] == "RESET_GAME":
                engine.reset()
                await websocket.send_json({"type": "RESET_ACK"})
            elif message["type"] == "LIVE_UPDATE":
                # Robust Predictive targeting
                active_piece = message["payload"]
                last_active_pos["x"] = active_piece["x"]
                last_active_pos["y"] = active_piece["y"]
                
                if active_piece["y"] > 8 and not engine.locked_cell:
                    # Deterministic but frequent check
                    if (hash(str(active_piece)) % 100) < 12:
                        tx, ty = active_piece["x"], min(19, active_piece["y"] + 2)
                        if engine.grid[ty][tx] == 0:
                            engine.locked_cell = {"x": tx, "y": ty}
                            lock_id += 1
                            current_id = lock_id
                            await websocket.send_json({"type": "CELL_LOCK", "payload": engine.locked_cell})
                            
                            # Managed cleanup
                            async def delayed_clear(cid):
                                await asyncio.sleep(2.5)
                                if lock_id == cid: # Only clear if it's still the same lock
                                    engine.clear_lock()
                                    await websocket.send_json({"type": "CLEAR_LOCK"})
                            
                            asyncio.create_task(delayed_clear(current_id))
    except WebSocketDisconnect:
        print("Client disconnected")
        shadow_task.cancel()
    except Exception as e:
        print(f"Error: {e}")
        shadow_task.cancel()
