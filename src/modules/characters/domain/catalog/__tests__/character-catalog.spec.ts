import { CharacterCode } from '../../enums/character-code.enum';
import { CharacterGroup } from '../../enums/character-group.enum';
import { CharacterUniverse } from '../../enums/character-universe.enum';
import { CHARACTER_CATALOG, findCharacter } from '../character-catalog';

describe('CHARACTER_CATALOG', () => {
  it('defines exactly one entry for each of the 12 character codes', () => {
    const codes = CHARACTER_CATALOG.map((character) => character.code);

    expect(codes).toHaveLength(12);
    expect(new Set(codes)).toEqual(new Set(Object.values(CharacterCode)));
  });

  it('covers Marvel, DC, and other superhero universes', () => {
    const universes = new Set(
      CHARACTER_CATALOG.map((character) => character.universe),
    );

    expect(universes).toEqual(new Set(Object.values(CharacterUniverse)));
  });

  it('groups Marvel and DC characters by universe and every other universe under OTHERS', () => {
    const groupOf = (code: CharacterCode) => findCharacter(code).group;

    for (const character of CHARACTER_CATALOG) {
      if (character.universe === CharacterUniverse.MARVEL) {
        expect(character.group).toBe(CharacterGroup.MARVEL);
      } else if (character.universe === CharacterUniverse.DC) {
        expect(character.group).toBe(CharacterGroup.DC);
      } else {
        expect(character.group).toBe(CharacterGroup.OTHERS);
      }
    }

    expect(groupOf(CharacterCode.HELLBOY)).toBe(CharacterGroup.OTHERS);
    expect(groupOf(CharacterCode.SPAWN)).toBe(CharacterGroup.OTHERS);
    expect(groupOf(CharacterCode.INVINCIBLE)).toBe(CharacterGroup.OTHERS);
  });

  it('gives every character a non-blank name and a root-relative avatar path', () => {
    for (const character of CHARACTER_CATALOG) {
      expect(character.name.trim()).not.toBe('');
      expect(character.avatarPath).toMatch(/^\/characters\/[a-z-]+\.svg$/);
    }
  });
});

describe('findCharacter', () => {
  it('returns the catalog entry for a known code', () => {
    expect(findCharacter(CharacterCode.SPIDER_MAN)).toEqual({
      code: CharacterCode.SPIDER_MAN,
      name: 'Spider-Man',
      universe: CharacterUniverse.MARVEL,
      group: CharacterGroup.MARVEL,
      avatarPath: '/characters/spider-man.svg',
    });
  });

  it('throws for a code outside the catalog', () => {
    expect(() => findCharacter('UNKNOWN' as CharacterCode)).toThrow(
      'Unknown character code: UNKNOWN',
    );
  });
});
