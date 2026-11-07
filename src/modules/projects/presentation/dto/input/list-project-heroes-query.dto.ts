import { USER_NAME_MAX_LENGTH } from '@shared/domain/constraints';
import { PaginationQueryDto, TextFilterField } from '@shared/presentation/dto';

export class ListProjectHeroesQueryDto extends PaginationQueryDto {
  @TextFilterField({ maxLength: USER_NAME_MAX_LENGTH })
  name?: string;
}
