import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import {
  PaginationQueryDto,
  SortByField,
  SortOrderField,
  TextFilterField,
  UuidFilterField,
} from '@shared/presentation/dto';
import { PROJECT_NAME_MAX_LENGTH } from '../../../domain/constraints/project-input.constraints';
import { ProjectStatus } from '../../../domain/enums/project-status.enum';
import {
  PROJECT_SORT_FIELDS,
  type ProjectListSort,
} from '../../../domain/repositories/project-list-sort';

export class ListProjectsQueryDto extends PaginationQueryDto {
  @SortByField(PROJECT_SORT_FIELDS)
  sortBy?: ProjectListSort['sortBy'];

  @SortOrderField()
  sortOrder?: ProjectListSort['sortOrder'];

  @TextFilterField({ maxLength: PROJECT_NAME_MAX_LENGTH })
  name?: string;

  @ApiPropertyOptional({
    enum: ProjectStatus,
    description: 'Filter by derived project status (exact match).',
  })
  @IsOptional()
  @IsEnum(ProjectStatus, {
    message: i18nValidationMessage('validation.IS_ENUM'),
  })
  status?: ProjectStatus;

  @UuidFilterField('Filter by responsible hero uuid (exact match).')
  responsible?: string;
}
