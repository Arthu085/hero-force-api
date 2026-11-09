import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { ProjectGoalProgressPeriod } from '../../../domain/enums/project-goal-progress-period.enum';

export class GetProjectGoalProgressQueryDto {
  @ApiPropertyOptional({
    enum: ProjectGoalProgressPeriod,
    default: ProjectGoalProgressPeriod.LAST_30_DAYS,
    description:
      'Chart window ending now: the last 7, 30, or 90 days, or all history since the project was created.',
  })
  @IsOptional()
  @IsEnum(ProjectGoalProgressPeriod, {
    message: i18nValidationMessage('validation.IS_ENUM'),
  })
  period: ProjectGoalProgressPeriod = ProjectGoalProgressPeriod.LAST_30_DAYS;
}
