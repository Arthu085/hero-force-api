import { ApiProperty } from '@nestjs/swagger';
import type { ProjectEntity } from '../../../domain/entities/project.entity';
import { ProjectGoalResponseDto } from './project-goal.response';
import { ProjectListResponseDto } from './project-list.response';

export class ProjectDetailResponseDto extends ProjectListResponseDto {
  @ApiProperty()
  description!: string;

  @ApiProperty({
    type: [ProjectGoalResponseDto],
    description: 'The six fixed goals, in catalog order.',
  })
  goals!: ProjectGoalResponseDto[];

  static fromDomain(
    project: ProjectEntity,
    translate: (key: string) => string,
  ): ProjectDetailResponseDto {
    const dto = new ProjectDetailResponseDto();

    this.assignBase(dto, project, translate);
    dto.description = project.description;
    dto.goals = project.goals.map((goal) =>
      ProjectGoalResponseDto.fromDomain(goal, translate),
    );

    return dto;
  }
}
