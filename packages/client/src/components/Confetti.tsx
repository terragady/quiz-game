import { useEffect, useRef } from 'react';

const COLORS = ['#7c5cff', '#21d4fd', '#2ce38a', '#ffd15c', '#ff5b6e', '#a48bff'];

interface Piece {
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
  spin: number;
  velocityY: number;
  velocityX: number;
  drift: number;
}

export function Confetti({
  pieceCount = 160,
  durationMs = 6000,
}: {
  pieceCount?: number;
  durationMs?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const pieces: Piece[] = Array.from({ length: pieceCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * -height,
      size: 6 + Math.random() * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.25,
      velocityY: 2 + Math.random() * 3,
      velocityX: (Math.random() - 0.5) * 1.5,
      drift: Math.random() * Math.PI * 2,
    }));

    let frame = 0;
    const startedAt = performance.now();
    const render = (now: number) => {
      if (now - startedAt > durationMs) {
        context.clearRect(0, 0, width, height);
        window.removeEventListener('resize', onResize);
        return;
      }
      context.clearRect(0, 0, width, height);
      for (const piece of pieces) {
        piece.drift += 0.02;
        piece.y += piece.velocityY;
        piece.x += piece.velocityX + Math.sin(piece.drift) * 0.8;
        piece.rotation += piece.spin;
        if (piece.y > height + piece.size) {
          piece.y = -piece.size;
          piece.x = Math.random() * width;
        }
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.rotation);
        context.fillStyle = piece.color;
        context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6);
        context.restore();
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, [pieceCount, durationMs]);

  return <canvas className="confetti" ref={canvasRef} aria-hidden="true" />;
}
