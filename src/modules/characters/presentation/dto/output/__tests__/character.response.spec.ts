import { CharacterCode } from '../../../../domain/enums/character-code.enum';
import { CharacterGroup } from '../../../../domain/enums/character-group.enum';
import { CharacterUniverse } from '../../../../domain/enums/character-universe.enum';
import { CharacterResponseDto } from '../character.response';

describe('CharacterResponseDto', () => {
  it('maps a catalog code with translated universe and group labels', () => {
    const labels: Record<string, string> = {
      'enums.character_universe.marvel': 'Marvel Comics',
      'enums.character_group.marvel': 'Marvel Group',
    };

    const translate = jest.fn((key: string) => labels[key] ?? key);

    const dto = CharacterResponseDto.fromCode(
      CharacterCode.IRON_MAN,
      translate,
    );

    expect(translate).toHaveBeenCalledWith('enums.character_universe.marvel');
    expect(translate).toHaveBeenCalledWith('enums.character_group.marvel');
    expect(dto).toEqual({
      code: CharacterCode.IRON_MAN,
      name: 'Iron Man',
      universe: CharacterUniverse.MARVEL,
      universeLabel: 'Marvel Comics',
      group: CharacterGroup.MARVEL,
      groupLabel: 'Marvel Group',
      avatarPath: '/characters/iron-man.svg',
    });
  });

  it('keeps the universe of a character grouped under OTHERS', () => {
    const translate = jest.fn((key: string) =>
      key === 'enums.character_group.others' ? 'Others' : key,
    );

    const dto = CharacterResponseDto.fromCode(CharacterCode.SPAWN, translate);

    expect(dto).toEqual({
      code: CharacterCode.SPAWN,
      name: 'Spawn',
      universe: CharacterUniverse.IMAGE,
      universeLabel: CharacterUniverse.IMAGE,
      group: CharacterGroup.OTHERS,
      groupLabel: 'Others',
      avatarPath: '/characters/spawn.svg',
    });
  });

  it('falls back to the raw universe and group when no translation exists', () => {
    const dto = CharacterResponseDto.fromCode(
      CharacterCode.HELLBOY,
      (key) => key,
    );

    expect(dto.universeLabel).toBe(CharacterUniverse.DARK_HORSE);
    expect(dto.groupLabel).toBe(CharacterGroup.OTHERS);
    expect(dto.avatarPath).toBe('/characters/hellboy.svg');
  });
});
