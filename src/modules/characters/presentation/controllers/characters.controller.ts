import { Controller } from '@nestjs/common';
import { endpoint } from '@shared/presentation/builders';
import { Translator, type Translate } from '@shared/presentation/decorators';
import { ListCharactersUseCase } from '../../application/use-cases/list-characters.use-case';
import { CharacterResponseDto } from '../dto/output/character.response';

@Controller('characters')
export class CharactersController {
  constructor(private readonly listCharacters: ListCharactersUseCase) {}

  @(endpoint()
    .get()
    .public()
    .successMessage('success.ok')
    .tags('characters')
    .summary('List the fixed superhero character catalog')
    .description(
      'Public, so the registration page can offer a character before the user has an account. The catalog is defined in code; several users may pick the same character.',
    )
    .response(CharacterResponseDto, undefined, { isArray: true })
    .build())
  findAll(@Translator() translate: Translate): CharacterResponseDto[] {
    return this.listCharacters
      .execute()
      .map((character) =>
        CharacterResponseDto.fromDomain(character, translate),
      );
  }
}
