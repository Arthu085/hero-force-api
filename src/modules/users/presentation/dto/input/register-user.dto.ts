import { PickType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class RegisterUserDto extends PickType(CreateUserDto, [
  'name',
  'email',
  'password',
  'characterCode',
] as const) {}
