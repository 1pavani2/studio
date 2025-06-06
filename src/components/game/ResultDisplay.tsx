"use client";

import type { Result } from '@/lib/gameLogic';
import { cn } from '@/lib/utils';

interface ResultDisplayProps {
  result: Result;
}

export function ResultDisplay({ result }: ResultDisplayProps) {
  if (!result) return null;

  let message = '';
  let textColor = '';

  switch (result) {
    case 'Win':
      message = 'You Win!';
      textColor = 'text-accent'; // Lime Green
      break;
    case 'Lose':
      message = 'You Lose!';
      textColor = 'text-destructive'; // Red
      break;
    case 'Draw':
      message = "It's a Draw!";
      textColor = 'text-foreground'; // Neutral
      break;
  }

  return (
    <div className="my-6 text-center">
      <p className={cn("text-3xl md:text-4xl font-bold font-headline animate-pulse", textColor)}>{message}</p>
    </div>
  );
}
