import { ApiProperty } from '@nestjs/swagger';
import { translateOrFallback } from '@shared/presentation/http';
import {
  PROJECT_GOAL_PROGRESS_MAX,
  PROJECT_GOAL_PROGRESS_MIN,
} from '../../../domain/constraints/project-input.constraints';
import type {
  ProjectGoalProgress,
  ProjectGoalProgressChange,
  ProjectGoalProgressSeries,
} from '../../../domain/entities/project-goal-progress';
import { ProjectGoalProgressPeriod } from '../../../domain/enums/project-goal-progress-period.enum';
import { ProjectGoalType } from '../../../domain/enums/project-goal-type.enum';

const PROGRESS_RANGE = {
  minimum: PROJECT_GOAL_PROGRESS_MIN,
  maximum: PROJECT_GOAL_PROGRESS_MAX,
};

export class ProjectGoalProgressChangeResponseDto {
  @ApiProperty({ type: String, format: 'date-time' })
  at!: Date;

  @ApiProperty(PROGRESS_RANGE)
  previousProgress!: number;

  @ApiProperty(PROGRESS_RANGE)
  progress!: number;

  static fromDomain(
    change: ProjectGoalProgressChange,
  ): ProjectGoalProgressChangeResponseDto {
    const dto = new ProjectGoalProgressChangeResponseDto();

    dto.at = change.at;
    dto.previousProgress = change.previousProgress;
    dto.progress = change.progress;

    return dto;
  }
}

export class ProjectGoalProgressSeriesResponseDto {
  @ApiProperty({ enum: ProjectGoalType })
  goal!: ProjectGoalType;

  @ApiProperty()
  goalLabel!: string;

  @ApiProperty({
    ...PROGRESS_RANGE,
    type: Number,
    nullable: true,
    description:
      'Progress at `recordedFrom`; null when no history was recorded for the project.',
  })
  startProgress!: number | null;

  @ApiProperty({ ...PROGRESS_RANGE, description: 'Stored progress now.' })
  currentProgress!: number;

  @ApiProperty({
    type: [ProjectGoalProgressChangeResponseDto],
    description:
      'Recorded progress changes since `from`, oldest first; events with the same timestamp keep their recorded order.',
  })
  changes!: ProjectGoalProgressChangeResponseDto[];

  static fromDomain(
    series: ProjectGoalProgressSeries,
    translate: (key: string) => string,
  ): ProjectGoalProgressSeriesResponseDto {
    const dto = new ProjectGoalProgressSeriesResponseDto();

    dto.goal = series.goal;
    dto.goalLabel = translateOrFallback(
      translate,
      `enums.project_goal.${series.goal.toLowerCase()}`,
      series.goal,
    );
    dto.startProgress = series.startProgress;
    dto.currentProgress = series.currentProgress;
    dto.changes = series.changes.map((change) =>
      ProjectGoalProgressChangeResponseDto.fromDomain(change),
    );

    return dto;
  }
}

export class ProjectGoalProgressResponseDto {
  @ApiProperty({ enum: ProjectGoalProgressPeriod })
  period!: ProjectGoalProgressPeriod;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'Window start: the period start, never earlier than the project creation.',
  })
  from!: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'Window end: the response time, or the latest change if later.',
  })
  to!: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'First instant in the window whose progress is known from recorded history. Later than `from` for projects created before history tracking; null when the project has no recorded history.',
  })
  recordedFrom!: Date | null;

  @ApiProperty({
    type: [ProjectGoalProgressSeriesResponseDto],
    description: 'The six fixed goals, in catalog order.',
  })
  goals!: ProjectGoalProgressSeriesResponseDto[];

  static fromDomain(
    progress: ProjectGoalProgress,
    translate: (key: string) => string,
  ): ProjectGoalProgressResponseDto {
    const dto = new ProjectGoalProgressResponseDto();

    dto.period = progress.period;
    dto.from = progress.from;
    dto.to = progress.to;
    dto.recordedFrom = progress.recordedFrom;
    dto.goals = progress.goals.map((series) =>
      ProjectGoalProgressSeriesResponseDto.fromDomain(series, translate),
    );

    return dto;
  }
}
