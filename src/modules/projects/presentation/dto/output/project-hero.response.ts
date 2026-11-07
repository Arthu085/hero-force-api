import { ApiProperty } from '@nestjs/swagger';
import { CharacterResponseDto } from '@modules/characters/presentation';
import type { ProjectHero } from '../../../domain/entities/project-hero';

export class ProjectHeroResponseDto {
  @ApiProperty()
  uuid!: string;

  @ApiProperty({ description: 'Real name of the hero.' })
  name!: string;

  @ApiProperty({ type: CharacterResponseDto, nullable: true })
  character!: CharacterResponseDto | null;

  static fromDomain(
    hero: ProjectHero,
    translate: (key: string) => string,
  ): ProjectHeroResponseDto {
    const dto = new ProjectHeroResponseDto();

    dto.uuid = hero.uuid;
    dto.name = hero.name;
    dto.character = hero.character
      ? CharacterResponseDto.fromCode(hero.character, translate)
      : null;

    return dto;
  }
}
