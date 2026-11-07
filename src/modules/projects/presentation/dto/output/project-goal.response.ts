import { ApiProperty } from '@nestjs/swagger';
import { translateOrFallback } from '@shared/presentation/http';
import {
  PROJECT_GOAL_PROGRESS_MAX,
  PROJECT_GOAL_PROGRESS_MIN,
} from '../../../domain/constraints/project-input.constraints';
import type { ProjectGoal } from '../../../domain/entities/project.entity';
import { ProjectGoalType } from '../../../domain/enums/project-goal-type.enum';

export class ProjectGoalResponseDto {
  @ApiProperty({ enum: ProjectGoalType })
  goal!: ProjectGoalType;

  @ApiProperty()
  goalLabel!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({
    minimum: PROJECT_GOAL_PROGRESS_MIN,
    maximum: PROJECT_GOAL_PROGRESS_MAX,
  })
  progress!: number;

  static fromDomain(
    goal: ProjectGoal,
    translate: (key: string) => string,
  ): ProjectGoalResponseDto {
    const dto = new ProjectGoalResponseDto();

    dto.goal = goal.goal;
    dto.goalLabel = translateOrFallback(
      translate,
      `enums.project_goal.${goal.goal.toLowerCase()}`,
      goal.goal,
    );
    dto.description = goal.description;
    dto.progress = goal.progress;

    return dto;
  }
}
