import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  ProjectHistory,
  ProjectHistoryPerson,
  ProjectHistoryValues,
} from '../../../domain/entities/project-history';
import { ProjectGoalType } from '../../../domain/enums/project-goal-type.enum';
import { ProjectHistoryType } from '../../../domain/enums/project-history-type.enum';

export class ProjectHistoryPersonResponseDto {
  @ApiProperty({ format: 'uuid' })
  uuid!: string;

  @ApiProperty()
  name!: string;
}

export class ProjectHistoryValuesResponseDto {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ type: ProjectHistoryPersonResponseDto })
  responsible?: ProjectHistoryPerson;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  progress?: number;
}

export class ProjectHistoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  uuid!: string;

  @ApiProperty({ enum: ProjectHistoryType })
  type!: ProjectHistoryType;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: ProjectHistoryPersonResponseDto, nullable: true })
  actor!: ProjectHistoryPerson | null;

  @ApiProperty({ enum: ProjectGoalType, nullable: true })
  goal!: ProjectGoalType | null;

  @ApiProperty({ type: ProjectHistoryValuesResponseDto, nullable: true })
  previousValues!: ProjectHistoryValues | null;

  @ApiProperty({ type: ProjectHistoryValuesResponseDto, nullable: true })
  newValues!: ProjectHistoryValues | null;

  static fromDomain(entry: ProjectHistory): ProjectHistoryResponseDto {
    const dto = new ProjectHistoryResponseDto();

    dto.uuid = entry.uuid;
    dto.type = entry.type;
    dto.createdAt = entry.createdAt;
    dto.actor = entry.actor
      ? { uuid: entry.actor.uuid, name: entry.actor.name }
      : null;
    dto.goal = entry.goal;
    dto.previousValues = entry.previousValues;
    dto.newValues = entry.newValues;

    return dto;
  }
}
