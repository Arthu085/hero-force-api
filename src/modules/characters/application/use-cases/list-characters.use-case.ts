import { Injectable } from '@nestjs/common';
import {
  CHARACTER_CATALOG,
  type CharacterDefinition,
} from '../../domain/catalog/character-catalog';

@Injectable()
export class ListCharactersUseCase {
  execute(): readonly CharacterDefinition[] {
    return CHARACTER_CATALOG;
  }
}
