
"use client";

import type { Result } from '@/lib/gameLogic';
import { cn } from '@/lib/utils';

interface ResultDisplayProps {
  result: Result; // This should be the result from THE CURRENT PLAYER'S perspective
  playerRole: 'player1' | 'player2' | null; // To contextualize if needed, though result prop should be pre-adjusted
}

export function ResultDisplay({ result, playerRole }: ResultDisplayProps) {
  if (!result || !playerRole) return null;

  let message = '';
  let textColor = '';

  switch (result) {
    case 'Win':
      message = 'You Win!';
      textColor = 'text-accent'; 
      break;
    case 'Lose':
      message = 'You Lose!';
      textColor = 'text-destructive';
      break;
    case 'Draw':
      message = "It's a Draw!";
      textColor = 'text-foreground'; 
      break;
  }

  return (
    <div className="my-6 text-center">
      <p className={cn("text-3xl md:text-4xl font-bold font-headline animate-pulse", textColor)}>{message}</p>
    </div>
  );
}
