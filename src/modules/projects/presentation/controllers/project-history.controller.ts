import { Controller, HttpStatus, Param, Query } from '@nestjs/common';
import { PaginatedResult } from '@shared/application/dto';
import { Subject } from '@shared/domain/authorization/subject';
import { Action } from '@shared/domain/enums/action.enum';
import { endpoint } from '@shared/presentation/builders';
import { CurrentActor } from '@shared/presentation/decorators';
import type { AuthenticatedUser } from '@shared/presentation/http';
import { ParseUuidParamPipe } from '@shared/presentation/pipes';
import { ListProjectHistoryUseCase } from '../../application/use-cases/list-project-history.use-case';
import { ListProjectHistoryQueryDto } from '../dto/input/list-project-history-query.dto';
import { ProjectHistoryResponseDto } from '../dto/output/project-history.response';

@Controller('projects/:uuid/history')
export class ProjectHistoryController {
  constructor(private readonly listProjectHistory: ListProjectHistoryUseCase) {}

  @(endpoint()
    .get()
    .ability({ action: Action.READ, subject: Subject.PROJECT })
    .audit('Project.history')
    .successMessage('success.ok')
    .tags('projects')
    .summary('List project change history')
    .description(
      'Read-only business events, newest first. Uses the same project visibility and active-record rules as project details. Deleted projects are not accessible. Actor data contains only uuid and name, including soft-deleted users.',
    )
    .errorResponse(HttpStatus.NOT_FOUND, 'Project not found.')
    .errorResponse(HttpStatus.CONFLICT, 'Project is inactive.')
    .paginatedResponse(ProjectHistoryResponseDto)
    .build())
  async findAll(
    @Param('uuid', ParseUuidParamPipe) uuid: string,
    @Query() query: ListProjectHistoryQueryDto,
    @CurrentActor() actor: AuthenticatedUser,
  ): Promise<PaginatedResult<ProjectHistoryResponseDto>> {
    const result = await this.listProjectHistory.execute({
      uuid,
      page: query.page,
      limit: query.limit,
      viewer: actor,
    });

    return result.map((entry) => ProjectHistoryResponseDto.fromDomain(entry));
  }
}
