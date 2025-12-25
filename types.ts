export enum GameState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  FINISHED = 'FINISHED'
}

export interface WordCard {
  word: string;
  definition: string;
  example: string;
}

export interface GameResult {
  word: string;
  status: 'correct' | 'pass';
}

export type Difficulty = 'facil' | 'barrio' | 'experto';