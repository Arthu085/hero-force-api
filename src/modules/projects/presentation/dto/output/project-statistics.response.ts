import { ApiProperty } from '@nestjs/swagger';
import type { ProjectStatistics } from '../../../domain/repositories/project.repository';

export class ProjectStatisticsResponseDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  pending!: number;

  @ApiProperty()
  inProgress!: number;

  @ApiProperty()
  completed!: number;

  @ApiProperty({
    minimum: 0,
    maximum: 100,
    description:
      'Average overall progress of the visible projects, rounded down; 0 when there are none.',
  })
  averageProgress!: number;

  static fromDomain(
    statistics: ProjectStatistics,
  ): ProjectStatisticsResponseDto {
    const dto = new ProjectStatisticsResponseDto();

    dto.total = statistics.total;
    dto.pending = statistics.pending;
    dto.inProgress = statistics.inProgress;
    dto.completed = statistics.completed;
    dto.averageProgress = statistics.averageProgress;

    return dto;
  }
}
