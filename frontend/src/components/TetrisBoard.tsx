'use client';
import React, { useEffect, useRef } from 'react';
import { useTetris } from '../hooks/useTetris';
import { COLS, ROWS, COLORS, SHAPES, PieceType } from '../lib/tetris';

const BLOCK_SIZE = 30;

export const TetrisBoard: React.FC = () => {
  const [mounted, setMounted] = React.useState(false);
  const [shake, setShake] = React.useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<any[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { 
    grid, activePiece, ghostPosition, nextPieceType, holdPiece,
    movePiece, rotatePiece, hardDrop, holdPieceAction, togglePause,
    score, gameOver, isPaused, chaos, thoughts, lockedCell, comboMessage 
  } = useTetris();

  const getThemeColor = (opacity = 1) => {
    if (chaos < 40) return `rgba(6, 182, 212, ${opacity})`; // Cyan
    if (chaos < 75) return `rgba(234, 179, 8, ${opacity})`; // Yellow
    return `rgba(239, 68, 68, ${opacity})`; // Red
  };

  const themeColor = getThemeColor();
  const themeColorMuted = getThemeColor(0.5);

  // Screen Shake Reduction
  useEffect(() => {
    if (shake > 0) {
      const timer = setTimeout(() => setShake(prev => Math.max(0, prev - 1)), 50);
      return () => clearTimeout(timer);
    }
  }, [shake]);

  // Trigger shake on lockedCell or line clear
  useEffect(() => {
    if (lockedCell) setShake(10);
  }, [lockedCell]);

  // Trigger particles and shake when grid changes
  const prevGridRef = useRef<(PieceType | number)[][]>(grid);
  const prevLockedRef = useRef<any>(lockedCell);
  
  useEffect(() => {
    if (!mounted) return;
    
    // Detect Purge (Locked cell was present, now it's gone)
    if (prevLockedRef.current && !lockedCell && !isPaused) {
       setShake(30);
       const lx = prevLockedRef.current.x * BLOCK_SIZE + BLOCK_SIZE/2;
       const ly = prevLockedRef.current.y * BLOCK_SIZE + BLOCK_SIZE/2;
       for (let i = 0; i < 40; i++) {
         particlesRef.current.push({
           x: lx, y: ly,
           vx: (Math.random() - 0.5) * 12,
           vy: (Math.random() - 0.5) * 12,
           life: 1.5,
           size: Math.random() * 6 + 2,
           color: '#ef4444' // Red purge burst
         });
       }
    }

    const prev = prevGridRef.current;
    const current = grid;
    
    // Detect Line Clear by finding rows that were full in prev
    const fullRows = [];
    for (let y = 0; y < ROWS; y++) {
      if (prev[y].every(v => v !== 0)) {
        fullRows.push(y);
      }
    }
    
    if (fullRows.length > 0 && !isPaused) {
       setShake(10 * fullRows.length);
       fullRows.forEach(y => {
         for (let x = 0; x < COLS; x++) {
           for (let i = 0; i < 2; i++) {
             particlesRef.current.push({
               x: x * BLOCK_SIZE + Math.random() * BLOCK_SIZE,
               y: y * BLOCK_SIZE + Math.random() * BLOCK_SIZE,
               vx: (Math.random() - 0.5) * 6,
               vy: (Math.random() - 0.5) * 6,
               life: 1.0,
               size: Math.random() * 3 + 1,
               color: '#06b6d4'
             });
           }
         }
       });
    }

    prevGridRef.current = grid;
    prevLockedRef.current = lockedCell;
  }, [grid, lockedCell, isPaused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const glitchX = chaos > 70 ? (Math.random() - 0.5) * 5 : 0;
    const glitchY = chaos > 70 ? (Math.random() - 0.5) * 5 : 0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. Stable System Substrate (Background Rain)
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
    for (let i = 0; i < 25; i++) {
        const char = String.fromCharCode(0x30A0 + Math.random() * 96);
        ctx.fillText(char, Math.random() * canvas.width, Math.random() * canvas.height);
    }

    // 2. Kernel Glitch (Translated Layer)
    ctx.save();
    ctx.translate(glitchX, glitchY);

    // High-Chaos Chromatic Flash (Subtle)
    if (chaos > 85 && Math.random() > 0.95) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    grid.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
            const pieceColor = COLORS[value as unknown as PieceType] || '#4b5563';
            ctx.fillStyle = pieceColor;
            ctx.shadowBlur = 5;
            ctx.shadowColor = pieceColor;
            ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
            
            // Inner highlight
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.strokeRect(x * BLOCK_SIZE + 2, y * BLOCK_SIZE + 2, BLOCK_SIZE - 5, BLOCK_SIZE - 5);
            ctx.shadowBlur = 0;
        } else {
            ctx.strokeStyle = 'rgba(31, 41, 55, 0.3)';
            ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
        }
      });
    });

    if (activePiece && ghostPosition && !isPaused) {
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      activePiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value) {
            const gx = (ghostPosition.x + x) * BLOCK_SIZE;
            const gy = (ghostPosition.y + y) * BLOCK_SIZE;
            if (gy >= 0) {
              ctx.strokeRect(gx + 2, gy + 2, BLOCK_SIZE - 5, BLOCK_SIZE - 5);
            }
          }
        });
      });
      ctx.setLineDash([]);
    }

    if (activePiece && !isPaused) {
      ctx.fillStyle = COLORS[activePiece.type as PieceType];
      ctx.shadowBlur = 10;
      ctx.shadowColor = COLORS[activePiece.type as PieceType];
      
      activePiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value) {
            const px = (activePiece.position.x + x) * BLOCK_SIZE;
            const py = (activePiece.position.y + y) * BLOCK_SIZE;
            if (py >= 0) {
              ctx.fillRect(px, py, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
              ctx.strokeStyle = 'rgba(255,255,255,0.4)';
              ctx.strokeRect(px + 1, py + 1, BLOCK_SIZE - 3, BLOCK_SIZE - 3);
            }
          }
        });
      });
      ctx.shadowBlur = 0;
    }
    
    if (lockedCell && !isPaused) {
      const lx = lockedCell.x * BLOCK_SIZE;
      const ly = lockedCell.y * BLOCK_SIZE;
      
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ef4444';
      ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + Math.sin(Date.now() / 100) * 0.3})`;
      ctx.fillRect(lx, ly, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx + 5, ly + 5); ctx.lineTo(lx + BLOCK_SIZE - 6, ly + BLOCK_SIZE - 6);
      ctx.moveTo(lx + BLOCK_SIZE - 6, ly + 5); ctx.lineTo(lx + 5, ly + BLOCK_SIZE - 6);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    
    ctx.restore();

    // Draw Combo Message Overlay
    if (comboMessage) {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        const scale = 1 + Math.sin(Date.now() / 50) * 0.1;
        ctx.scale(scale, scale);
        ctx.font = 'bold 24px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = comboMessage.type === 'tetris' ? '#22d3ee' : '#ef4444';
        ctx.shadowBlur = 20;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fillText(comboMessage.text, 0, 0);
        
        // Glitch effect for text
        if (Math.random() > 0.8) {
            ctx.fillStyle = 'white';
            ctx.fillText(comboMessage.text, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
        }
        ctx.restore();
    }

    // Draw Particles
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    particlesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
    });
    ctx.globalAlpha = 1;

    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 28px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText('CRITICAL FAILURE', canvas.width / 2, canvas.height / 2 - 20);
      ctx.font = '12px Orbitron';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText('PRESS ENTER TO REBOOT', canvas.width / 2, canvas.height / 2 + 30);
    } else if (isPaused) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = themeColor;
      ctx.font = 'bold 24px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 10);
      ctx.font = '12px Orbitron';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText('PRESS ENTER TO RESUME', canvas.width / 2, canvas.height / 2 + 30);
    }
  }, [grid, activePiece, ghostPosition, gameOver, isPaused, chaos, lockedCell, comboMessage, themeColor]);

  const filterStyle = {
    filter: `${chaos > 50 ? `contrast(${100 + (chaos - 50)}%)` : ''}`,
    transform: chaos > 80 ? `skewX(${(Math.random() - 0.5) * 2}deg)` : 'none'
  };

  const renderMiniPiece = (type: PieceType | null) => {
    if (!type) return <div className="w-20 h-20 bg-gray-900/50 rounded border border-gray-800" />;
    const shape = SHAPES[type];
    return (
      <div className="grid grid-cols-4 gap-1 p-2 bg-black/60 border border-gray-800 rounded shadow-inner">
        {shape.flat().map((val, i) => (
          <div key={i} className={`w-3 h-3 ${val ? '' : 'opacity-0'}`} style={{ backgroundColor: COLORS[type as PieceType] }} />
        ))}
      </div>
    );
  };

  const shakeStyle = {
    transform: shake > 0 ? `translate(${(Math.random() - 0.5) * shake}px, ${(Math.random() - 0.5) * shake}px)` : 'none',
  };

  return (
    <div className="flex flex-row items-stretch justify-center gap-8 p-10 bg-black text-white font-share-tech selection:bg-cyan-500 min-h-screen min-w-max relative overflow-hidden" style={shakeStyle}>
      {/* Neural Link HUD Lines */}
      <svg className="absolute inset-0 pointer-events-none z-0 opacity-20">
        <line x1="20%" y1="10%" x2="40%" y2="50%" stroke={themeColor} strokeWidth="0.5" className="animate-pulse" />
        <line x1="80%" y1="20%" x2="60%" y2="40%" stroke={themeColor} strokeWidth="0.5" className="animate-pulse" style={{ animationDelay: '1s' }} />
        <line x1="10%" y1="90%" x2="30%" y2="60%" stroke={themeColor} strokeWidth="0.5" className="animate-pulse" style={{ animationDelay: '0.5s' }} />
      </svg>
      {/* Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none z-[100] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%] opacity-20" />
      
      {/* LEFT PANEL */}
      <div className="flex flex-col gap-6 w-48 shrink-0 relative z-10">
        <div className="p-6 border-2 bg-black/80 backdrop-blur-xl relative overflow-hidden group transition-colors duration-1000" style={{ borderColor: themeColorMuted }}>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%] pointer-events-none" />
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 flex justify-between items-center font-orbitron transition-colors duration-1000" style={{ color: themeColor }}>
             <span>Hold Matrix</span>
             <div className="w-2 h-2 rounded-full animate-pulse transition-colors duration-1000" style={{ backgroundColor: themeColor, boxShadow: `0 0 8px ${themeColor}` }} />
          </div>
          <div className="flex justify-center h-24 items-center bg-black/50 rounded-lg border border-gray-900 shadow-inner">
            {renderMiniPiece(holdPiece)}
          </div>
        </div>

        <div className="p-5 border border-red-900/30 bg-black/80 backdrop-blur-xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20" />
          <div className="text-[10px] font-bold text-red-800 uppercase tracking-[0.2em] mb-4 font-orbitron">Entropy Pulse</div>
          <div className="h-64 w-full bg-black border border-red-900/20 relative overflow-hidden flex flex-col-reverse">
            <div 
              className="w-full bg-gradient-to-t from-red-950 via-red-600 to-red-400 transition-all duration-700"
              style={{ height: `${chaos}%`, boxShadow: '0 0 30px rgba(239, 68, 68, 0.2)' }}
            />
            <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.4)_2px,rgba(0,0,0,0.4)_4px)] pointer-events-none" />
            <div className="absolute inset-0 flex items-center justify-center text-2xl font-orbitron font-black text-white/80 tabular-nums">
              {chaos.toFixed(0)}
            </div>
          </div>
        </div>
      </div>

      {/* CENTER PANEL */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex justify-between items-end w-full px-2 border-b border-gray-800 pb-4 mb-2">
          <div>
            <h1 className="text-4xl font-black tracking-tighter italic leading-none font-orbitron bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">ENTROPIC</h1>
            <div className="text-[9px] text-cyan-500/70 mt-1 font-orbitron tracking-widest flex items-center gap-2">
               <span className="w-1.5 h-1.5 bg-cyan-500/50 rounded-full" />
               SYSTEM_PROTOCOL // AGGRESSIVE_MODE
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1 font-orbitron">Neural Score</div>
            <div className="text-3xl font-black font-orbitron text-white tabular-nums drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{score.toLocaleString()}</div>
          </div>
        </div>
        
        <div className="relative p-1 bg-gray-900 border-2 border-gray-800 rounded-xl shadow-2xl overflow-hidden group">
          <div className={`absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-transparent to-red-500/10 opacity-30 group-hover:opacity-60 transition-opacity duration-1000`} />
          <canvas
            ref={canvasRef}
            width={COLS * BLOCK_SIZE}
            height={ROWS * BLOCK_SIZE}
            className="relative rounded-lg transition-all duration-150"
            style={filterStyle}
          />
          {chaos > 80 && (
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] mix-blend-overlay animate-noise" />
          )}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex flex-col gap-6 w-72 relative z-10">
        <div className="p-6 border-2 bg-black/80 backdrop-blur-xl relative overflow-hidden group transition-colors duration-1000" style={{ borderColor: themeColorMuted }}>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%] pointer-events-none" />
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 flex justify-between items-center font-orbitron relative z-10 transition-colors duration-1000" style={{ color: themeColor }}>
            <span>Adversary Next</span>
            <div className="text-[8px] px-1.5 py-0.5 bg-black/40 border rounded transition-colors duration-1000" style={{ color: themeColor, borderColor: themeColorMuted }}>PREDICTIVE</div>
          </div>
          <div className="flex justify-center items-center h-24 bg-black/50 border border-gray-900 relative z-10">
            {renderMiniPiece(nextPieceType)}
          </div>
        </div>

        <div className="flex-1 p-6 border-2 bg-black/80 backdrop-blur-xl flex flex-col relative overflow-hidden group transition-colors duration-1000" style={{ borderColor: themeColorMuted }}>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%] pointer-events-none opacity-40" />
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-3 font-orbitron relative z-10 transition-colors duration-1000" style={{ color: themeColor }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_8px_currentColor]" style={{ backgroundColor: themeColor }} />
            Agent Intel
          </div>
          <div className="flex-1 font-mono text-[9px] text-gray-400 space-y-4 overflow-y-auto scrollbar-hide pr-2">
            {thoughts.map((thought: { text: string, time: string }, i: number) => (
              <div key={i} className={`flex gap-3 leading-relaxed ${i === 0 ? 'text-cyan-200' : 'opacity-40'}`}>
                <span className="text-cyan-800 font-bold shrink-0">[{thought.time}]</span>
                <p 
                  className={i === 0 && chaos > 50 ? 'animate-noise' : ''} 
                  style={i === 0 ? { filter: `blur(${chaos > 80 ? 0.5 : 0}px)`, opacity: 0.8 + (chaos / 500) } : {}}
                >
                  {thought.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl shadow-lg bg-[radial-gradient(circle_at_bottom_right,rgba(17,24,39,0.5),transparent)]">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-3 font-orbitron">Kernel Controls</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[9px] font-mono text-gray-400">
            <div className="flex justify-between border-b border-gray-900 pb-1"><span>ROT</span><span className="text-cyan-600 font-bold">[UP]</span></div>
            <div className="flex justify-between border-b border-gray-900 pb-1"><span>DROP</span><span className="text-cyan-600 font-bold">[SPC]</span></div>
            <div className="flex justify-between border-b border-gray-900 pb-1"><span>MOVE</span><span className="text-cyan-600 font-bold">[L/R]</span></div>
            <div className="flex justify-between border-b border-gray-900 pb-1"><span>HOLD</span><span className="text-cyan-600 font-bold">[C]</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};
