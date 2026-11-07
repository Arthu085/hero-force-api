import { CharacterCode } from '../../../../domain/enums/character-code.enum';
import { CharacterUniverse } from '../../../../domain/enums/character-universe.enum';
import { CharacterResponseDto } from '../character.response';

describe('CharacterResponseDto', () => {
  it('maps a catalog code with a translated universe label', () => {
    const translate = jest.fn(() => 'Marvel Comics');

    const dto = CharacterResponseDto.fromCode(
      CharacterCode.IRON_MAN,
      translate,
    );

    expect(translate).toHaveBeenCalledWith('enums.character_universe.marvel');
    expect(dto).toEqual({
      code: CharacterCode.IRON_MAN,
      name: 'Iron Man',
      universe: CharacterUniverse.MARVEL,
      universeLabel: 'Marvel Comics',
      avatarPath: '/characters/iron-man.svg',
    });
  });

  it('falls back to the raw universe and keeps a missing avatar as null', () => {
    const dto = CharacterResponseDto.fromCode(
      CharacterCode.HELLBOY,
      (key) => key,
    );

    expect(dto.universeLabel).toBe(CharacterUniverse.DARK_HORSE);
    expect(dto.avatarPath).toBeNull();
  });
});
