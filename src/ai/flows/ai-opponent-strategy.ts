'use server';

/**
 * @fileOverview This file defines the AI opponent strategy flow for the Rock Paper Scissors game.
 *
 * - aiOpponentStrategy - A function that determines the AI opponent's move.
 * - AiOpponentStrategyInput - The input type for the aiOpponentStrategy function.
 * - AiOpponentStrategyOutput - The return type for the aiOpponentStrategy function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiOpponentStrategyInputSchema = z.object({
  userMoves: z
    .array(z.enum(['Rock', 'Paper', 'Scissors']))
    .describe('An array of the user moves from previous rounds.'),
});
export type AiOpponentStrategyInput = z.infer<typeof AiOpponentStrategyInputSchema>;

const AiOpponentStrategyOutputSchema = z.object({
  aiMove: z.enum(['Rock', 'Paper', 'Scissors']).describe('The AI opponent move.'),
  reasoning: z.string().describe('The reasoning behind the AI opponent move.'),
});
export type AiOpponentStrategyOutput = z.infer<typeof AiOpponentStrategyOutputSchema>;

export async function aiOpponentStrategy(input: AiOpponentStrategyInput): Promise<AiOpponentStrategyOutput> {
  return aiOpponentStrategyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiOpponentStrategyPrompt',
  input: {schema: AiOpponentStrategyInputSchema},
  output: {schema: AiOpponentStrategyOutputSchema},
  prompt: `You are an expert Rock Paper Scissors player.

You are playing against a human. Your goal is to win, but also be unpredictable to keep the game interesting.

Here are the moves the human has made in the past: {{{userMoves}}}

Based on these past moves, analyze the human's strategy. What move are they most likely to make next?
Then, choose your move. Explain your reasoning, and then state your move.

Example output:
\n{"aiMove": "Rock", "reasoning": "The human has played paper three times in a row, so they are unlikely to play it again. I will play scissors to beat rock."}
\n`,
});

const aiOpponentStrategyFlow = ai.defineFlow(
  {
    name: 'aiOpponentStrategyFlow',
    inputSchema: AiOpponentStrategyInputSchema,
    outputSchema: AiOpponentStrategyOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
