export type Move = 'Rock' | 'Paper' | 'Scissors';
export type Result = 'Win' | 'Lose' | 'Draw' | null;

const outcomes: { [key in Move]: { beats: Move; losesTo: Move } } = {
  Rock: { beats: 'Scissors', losesTo: 'Paper' },
  Paper: { beats: 'Rock', losesTo: 'Scissors' },
  Scissors: { beats: 'Paper', losesTo: 'Rock' },
};

export function determineWinner(userMove: Move, aiMove: Move): Result {
  if (userMove === aiMove) {
    return 'Draw';
  }
  if (outcomes[userMove].beats === aiMove) {
    return 'Win';
  }
  return 'Lose';
}
