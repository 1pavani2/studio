
"use client";

import type { Move } from '@/lib/gameLogic';
import { Gem, Hand, ScissorsIcon as ScissorsLucide, HelpCircle, Loader2, User, Cpu } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MoveDisplayProps {
  move: Move | null;
  placeholderType?: 'user' | 'ai' | 'generic'; // 'user' for self, 'ai' for opponent (visual cue)
  isLoading?: boolean;
  isShaking?: boolean; // Generally not used for PvP to avoid distraction
  highlightColor?: string; 
  className?: string;
  isPlayerSide?: boolean; // To distinguish if this display is for the active player or opponent
}

const moveIcons: Record<Move, React.FC<LucideProps>> = {
  Rock: Gem,
  Paper: Hand,
  Scissors: ScissorsLucide,
};

export function MoveDisplay({
  move,
  placeholderType = 'generic',
  isLoading = false,
  isShaking = false,
  highlightColor,
  className,
  isPlayerSide = false,
}: MoveDisplayProps) {
  const Icon = move ? moveIcons[move] : null;
  
  const PlaceholderIcon = () => {
    // For PvP, 'user' icon for current player's empty slot, 'cpu' (or other) for opponent's empty slot
    if (isPlayerSide) {
      return <User className="w-20 h-20 text-muted-foreground" />;
    }
    return <Cpu className="w-20 h-20 text-muted-foreground" />; // Visually like an "opponent"
  };

  return (
    <div
      className={cn(
        "w-40 h-40 md:w-48 md:h-48 rounded-full flex items-center justify-center border-4 bg-card shadow-inner transition-all duration-300",
        isShaking && "animate-shake",
        highlightColor ? `border-[${highlightColor}] shadow-[0_0_15px_5px_var(--tw-shadow-color)]` : "border-border",
        className
      )}
      style={highlightColor ? { '--tw-shadow-color': highlightColor } as React.CSSProperties : {}}
      aria-live="polite"
    >
      {isLoading && !Icon ? ( // Show loader only if there's no move to display yet but loading is true
        <Loader2 className="w-20 h-20 animate-spin text-primary" />
      ) : Icon ? (
        <Icon className="w-24 h-24 text-foreground" />
      ) : (
        <PlaceholderIcon />
      )}
    </div>
  );
}
