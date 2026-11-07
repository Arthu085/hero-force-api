import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import {
  PROJECT_GOAL_DESCRIPTION_MAX_LENGTH,
  PROJECT_GOAL_PROGRESS_MAX,
  PROJECT_GOAL_PROGRESS_MIN,
} from '../../../domain/constraints/project-input.constraints';
import { ProjectGoalType } from '../../../domain/enums/project-goal-type.enum';

export class ProjectGoalChangeDto {
  @ApiProperty({ enum: ProjectGoalType })
  @IsEnum(ProjectGoalType, {
    message: i18nValidationMessage('validation.IS_ENUM'),
  })
  goal!: ProjectGoalType;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: PROJECT_GOAL_DESCRIPTION_MAX_LENGTH,
    description: 'Omitted keeps the current description; null clears it.',
  })
  @ValidateIf(
    (_: object, value: unknown) => value !== undefined && value !== null,
  )
  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @MaxLength(PROJECT_GOAL_DESCRIPTION_MAX_LENGTH, {
    message: i18nValidationMessage('validation.MAX_LENGTH'),
  })
  description?: string | null;

  @ApiPropertyOptional({
    minimum: PROJECT_GOAL_PROGRESS_MIN,
    maximum: PROJECT_GOAL_PROGRESS_MAX,
    description: 'Integer progress; omitted keeps the current value.',
  })
  @ValidateIf((_: object, value: unknown) => value !== undefined)
  @IsInt({ message: i18nValidationMessage('validation.IS_INT') })
  @Min(PROJECT_GOAL_PROGRESS_MIN, {
    message: i18nValidationMessage('validation.MIN'),
  })
  @Max(PROJECT_GOAL_PROGRESS_MAX, {
    message: i18nValidationMessage('validation.MAX'),
  })
  progress?: number;
}

export class UpdateProjectGoalsDto {
  @ApiProperty({
    type: [ProjectGoalChangeDto],
    uniqueItems: true,
    description:
      'Goals to change; goals left out keep their values. Each goal may appear once.',
  })
  @IsArray({ message: i18nValidationMessage('validation.IS_ARRAY') })
  @ArrayNotEmpty({
    message: i18nValidationMessage('validation.ARRAY_NOT_EMPTY'),
  })
  @ArrayUnique((change?: ProjectGoalChangeDto) => change?.goal, {
    message: i18nValidationMessage('validation.ARRAY_UNIQUE'),
  })
  @ValidateNested({ each: true })
  @Type(() => ProjectGoalChangeDto)
  goals!: ProjectGoalChangeDto[];
}
