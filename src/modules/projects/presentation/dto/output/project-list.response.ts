import { ApiProperty } from '@nestjs/swagger';
import { translateOrFallback } from '@shared/presentation/http';
import {
  PROJECT_GOAL_PROGRESS_MAX,
  PROJECT_GOAL_PROGRESS_MIN,
} from '../../../domain/constraints/project-input.constraints';
import type { ProjectEntity } from '../../../domain/entities/project.entity';
import { ProjectStatus } from '../../../domain/enums/project-status.enum';
import { ProjectHeroResponseDto } from './project-hero.response';

export class ProjectListResponseDto {
  @ApiProperty()
  uuid!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({
    enum: ProjectStatus,
    description: 'Derived from the goals; never set directly.',
  })
  status!: ProjectStatus;

  @ApiProperty()
  statusLabel!: string;

  @ApiProperty({
    minimum: PROJECT_GOAL_PROGRESS_MIN,
    maximum: PROJECT_GOAL_PROGRESS_MAX,
    description: 'Average of the six goals, rounded down.',
  })
  progress!: number;

  @ApiProperty({ type: ProjectHeroResponseDto })
  responsible!: ProjectHeroResponseDto;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromDomain(
    project: ProjectEntity,
    translate: (key: string) => string,
  ): ProjectListResponseDto {
    const dto = new ProjectListResponseDto();

    this.assignBase(dto, project, translate);

    return dto;
  }

  protected static assignBase(
    dto: ProjectListResponseDto,
    project: ProjectEntity,
    translate: (key: string) => string,
  ): void {
    dto.uuid = project.uuid;
    dto.name = project.name;
    dto.status = project.progressStatus;
    dto.statusLabel = translateOrFallback(
      translate,
      `enums.project_status.${project.progressStatus.toLowerCase()}`,
      project.progressStatus,
    );
    dto.progress = project.progress;
    dto.responsible = ProjectHeroResponseDto.fromDomain(
      project.responsible,
      translate,
    );
    dto.createdAt = project.createdAt;
    dto.updatedAt = project.updatedAt;
  }
}
