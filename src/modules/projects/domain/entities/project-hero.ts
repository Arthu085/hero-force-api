import type { CharacterCode } from '@modules/characters';

export interface ProjectHero {
  readonly id: number;
  readonly uuid: string;
  readonly name: string;
  readonly character: CharacterCode | null;
}
