import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { NON_BLANK_PATTERN } from '@shared/domain/constraints';
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
} from '../../../domain/constraints/project-input.constraints';

const isProvided = (_: object, value: unknown): boolean => value !== undefined;

export class UpdateProjectDto {
  @ApiPropertyOptional({
    example: 'Operation Skyfall',
    maxLength: PROJECT_NAME_MAX_LENGTH,
    pattern: NON_BLANK_PATTERN.source,
  })
  @ValidateIf(isProvided)
  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @Matches(NON_BLANK_PATTERN, {
    message: i18nValidationMessage('validation.NOT_EMPTY'),
  })
  @MaxLength(PROJECT_NAME_MAX_LENGTH, {
    message: i18nValidationMessage('validation.MAX_LENGTH'),
  })
  name?: string;

  @ApiPropertyOptional({
    maxLength: PROJECT_DESCRIPTION_MAX_LENGTH,
    pattern: NON_BLANK_PATTERN.source,
  })
  @ValidateIf(isProvided)
  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @Matches(NON_BLANK_PATTERN, {
    message: i18nValidationMessage('validation.NOT_EMPTY'),
  })
  @MaxLength(PROJECT_DESCRIPTION_MAX_LENGTH, {
    message: i18nValidationMessage('validation.MAX_LENGTH'),
  })
  description?: string;

  @ApiPropertyOptional({
    description:
      'Uuid of the new responsible hero: an active user holding the USER role.',
  })
  @ValidateIf(isProvided)
  @IsUUID(undefined, { message: i18nValidationMessage('validation.IS_UUID') })
  responsibleUuid?: string;
}
