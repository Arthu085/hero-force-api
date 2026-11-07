import { CharacterCode } from '../enums/character-code.enum';
import { CharacterGroup } from '../enums/character-group.enum';
import { CharacterUniverse } from '../enums/character-universe.enum';

export interface CharacterDefinition {
  code: CharacterCode;
  name: string;
  universe: CharacterUniverse;
  group: CharacterGroup;
  avatarPath: string | null;
}

export const CHARACTER_CATALOG: readonly CharacterDefinition[] = [
  {
    code: CharacterCode.SPIDER_MAN,
    name: 'Spider-Man',
    universe: CharacterUniverse.MARVEL,
    group: CharacterGroup.MARVEL,
    avatarPath: '/characters/spider-man.svg',
  },
  {
    code: CharacterCode.IRON_MAN,
    name: 'Iron Man',
    universe: CharacterUniverse.MARVEL,
    group: CharacterGroup.MARVEL,
    avatarPath: '/characters/iron-man.svg',
  },
  {
    code: CharacterCode.CAPTAIN_AMERICA,
    name: 'Captain America',
    universe: CharacterUniverse.MARVEL,
    group: CharacterGroup.MARVEL,
    avatarPath: '/characters/captain-america.svg',
  },
  {
    code: CharacterCode.THOR,
    name: 'Thor',
    universe: CharacterUniverse.MARVEL,
    group: CharacterGroup.MARVEL,
    avatarPath: '/characters/thor.svg',
  },
  {
    code: CharacterCode.BLACK_PANTHER,
    name: 'Black Panther',
    universe: CharacterUniverse.MARVEL,
    group: CharacterGroup.MARVEL,
    avatarPath: '/characters/black-panther.svg',
  },
  {
    code: CharacterCode.SUPERMAN,
    name: 'Superman',
    universe: CharacterUniverse.DC,
    group: CharacterGroup.DC,
    avatarPath: '/characters/superman.svg',
  },
  {
    code: CharacterCode.BATMAN,
    name: 'Batman',
    universe: CharacterUniverse.DC,
    group: CharacterGroup.DC,
    avatarPath: '/characters/batman.svg',
  },
  {
    code: CharacterCode.WONDER_WOMAN,
    name: 'Wonder Woman',
    universe: CharacterUniverse.DC,
    group: CharacterGroup.DC,
    avatarPath: '/characters/wonder-woman.svg',
  },
  {
    code: CharacterCode.THE_FLASH,
    name: 'The Flash',
    universe: CharacterUniverse.DC,
    group: CharacterGroup.DC,
    avatarPath: '/characters/the-flash.svg',
  },
  {
    code: CharacterCode.HELLBOY,
    name: 'Hellboy',
    universe: CharacterUniverse.DARK_HORSE,
    group: CharacterGroup.OTHERS,
    avatarPath: '/characters/hellboy.svg',
  },
  {
    code: CharacterCode.SPAWN,
    name: 'Spawn',
    universe: CharacterUniverse.IMAGE,
    group: CharacterGroup.OTHERS,
    avatarPath: '/characters/spawn.svg',
  },
  {
    code: CharacterCode.INVINCIBLE,
    name: 'Invincible',
    universe: CharacterUniverse.IMAGE,
    group: CharacterGroup.OTHERS,
    avatarPath: '/characters/invincible.svg',
  },
];

export function findCharacter(code: CharacterCode): CharacterDefinition {
  const character = CHARACTER_CATALOG.find((entry) => entry.code === code);

  if (!character) {
    throw new Error(`Unknown character code: ${code}`);
  }

  return character;
}
