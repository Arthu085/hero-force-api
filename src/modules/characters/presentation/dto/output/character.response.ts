import { ApiProperty } from '@nestjs/swagger';
import { translateOrFallback } from '@shared/presentation/http';
import {
  findCharacter,
  type CharacterDefinition,
} from '../../../domain/catalog/character-catalog';
import { CharacterCode } from '../../../domain/enums/character-code.enum';
import { CharacterGroup } from '../../../domain/enums/character-group.enum';
import { CharacterUniverse } from '../../../domain/enums/character-universe.enum';

export class CharacterResponseDto {
  @ApiProperty({ enum: CharacterCode })
  code!: CharacterCode;

  @ApiProperty({ example: 'Spider-Man' })
  name!: string;

  @ApiProperty({ enum: CharacterUniverse })
  universe!: CharacterUniverse;

  @ApiProperty()
  universeLabel!: string;

  @ApiProperty({
    enum: CharacterGroup,
    description:
      'Selector group of the character: Marvel, DC, or every other universe.',
  })
  group!: CharacterGroup;

  @ApiProperty()
  groupLabel!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '/characters/spider-man.svg',
    description:
      'Path of the avatar image shipped with the web app, relative to its origin; null when the character has no avatar.',
  })
  avatarPath!: string | null;

  static fromDomain(
    character: CharacterDefinition,
    translate: (key: string) => string,
  ): CharacterResponseDto {
    const dto = new CharacterResponseDto();

    dto.code = character.code;
    dto.name = character.name;
    dto.universe = character.universe;
    dto.universeLabel = translateOrFallback(
      translate,
      `enums.character_universe.${character.universe.toLowerCase()}`,
      character.universe,
    );
    dto.group = character.group;
    dto.groupLabel = translateOrFallback(
      translate,
      `enums.character_group.${character.group.toLowerCase()}`,
      character.group,
    );
    dto.avatarPath = character.avatarPath;

    return dto;
  }

  static fromCode(
    code: CharacterCode,
    translate: (key: string) => string,
  ): CharacterResponseDto {
    return this.fromDomain(findCharacter(code), translate);
  }
}
