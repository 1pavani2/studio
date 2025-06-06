
"use client";

import type { Move } from '@/lib/gameLogic';
import { Button } from '@/components/ui/button';
import { Gem, Hand, ScissorsIcon as ScissorsLucide } from 'lucide-react'; // Changed HandRock to Gem
import type { LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MoveButtonProps {
  move: Move;
  onClick: (move: Move) => void;
  disabled?: boolean;
  selected?: boolean;
  className?: string;
}

const moveIcons: Record<Move, React.FC<LucideProps>> = {
  Rock: Gem, // Changed HandRock to Gem
  Paper: Hand,
  Scissors: ScissorsLucide,
};

export function MoveButton({ move, onClick, disabled, selected, className }: MoveButtonProps) {
  const Icon = moveIcons[move];
  return (
    <Button
      variant={selected ? "default" : "outline"}
      size="lg"
      className={cn(
        "w-full md:w-48 h-24 flex flex-col items-center justify-center space-y-2 p-4 rounded-lg shadow-md transition-all duration-150 ease-in-out",
        "hover:shadow-xl transform hover:scale-105",
        selected && "ring-4 ring-offset-2 ring-primary scale-105 shadow-xl",
        disabled && "opacity-50 cursor-not-allowed hover:scale-100 hover:shadow-md",
        className
      )}
      onClick={() => onClick(move)}
      disabled={disabled}
      aria-label={`Select ${move}`}
    >
      <Icon className="w-10 h-10" />
      <span className="text-lg font-medium">{move}</span>
    </Button>
  );
}
