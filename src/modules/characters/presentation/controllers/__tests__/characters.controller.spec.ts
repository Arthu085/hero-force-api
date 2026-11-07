import { ListCharactersUseCase } from '../../../application/use-cases/list-characters.use-case';
import { CHARACTER_CATALOG } from '../../../domain/catalog/character-catalog';
import { CharactersController } from '../characters.controller';

describe('CharactersController', () => {
  it('returns the whole catalog in catalog order', () => {
    const controller = new CharactersController(new ListCharactersUseCase());

    const result = controller.findAll((key) => key);

    expect(result.map((character) => character.code)).toEqual(
      CHARACTER_CATALOG.map((character) => character.code),
    );
  });
});
