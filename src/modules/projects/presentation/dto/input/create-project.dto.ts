import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { NON_BLANK_PATTERN } from '@shared/domain/constraints';
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
} from '../../../domain/constraints/project-input.constraints';

export class CreateProjectDto {
  @ApiProperty({
    example: 'Operation Skyfall',
    maxLength: PROJECT_NAME_MAX_LENGTH,
    pattern: NON_BLANK_PATTERN.source,
  })
  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @Matches(NON_BLANK_PATTERN, {
    message: i18nValidationMessage('validation.NOT_EMPTY'),
  })
  @MaxLength(PROJECT_NAME_MAX_LENGTH, {
    message: i18nValidationMessage('validation.MAX_LENGTH'),
  })
  name!: string;

  @ApiProperty({
    example: 'Coordinate the response to the meteor shower.',
    maxLength: PROJECT_DESCRIPTION_MAX_LENGTH,
    pattern: NON_BLANK_PATTERN.source,
  })
  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @Matches(NON_BLANK_PATTERN, {
    message: i18nValidationMessage('validation.NOT_EMPTY'),
  })
  @MaxLength(PROJECT_DESCRIPTION_MAX_LENGTH, {
    message: i18nValidationMessage('validation.MAX_LENGTH'),
  })
  description!: string;

  @ApiProperty({
    description:
      'Uuid of the responsible hero: an active user holding the USER role (see GET /projects/heroes).',
  })
  @IsUUID(undefined, { message: i18nValidationMessage('validation.IS_UUID') })
  responsibleUuid!: string;
}
