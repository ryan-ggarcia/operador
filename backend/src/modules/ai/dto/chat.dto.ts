import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

export class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString() @IsNotEmpty() @MaxLength(20000)
  content: string;
}

export class ChatContextDto {
  @IsOptional() @IsUUID()
  jobId?: string;
}

@ValidatorConstraint({ name: 'userAtBothEnds' })
class UserAtBothEnds implements ValidatorConstraintInterface {
  validate(messages: unknown): boolean {
    if (!Array.isArray(messages) || messages.length === 0) return true; // ArrayMinSize já acusa
    const role = (item: unknown) => (item as { role?: unknown } | null)?.role;
    return role(messages[0]) === 'user' && role(messages[messages.length - 1]) === 'user';
  }

  defaultMessage(): string {
    return 'A conversa começa e termina com uma mensagem do usuário.';
  }
}

export class ChatDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(40)
  @ValidateNested({ each: true }) @Type(() => ChatMessageDto)
  @Validate(UserAtBothEnds)
  messages: ChatMessageDto[];

  @IsOptional() @ValidateNested() @Type(() => ChatContextDto)
  context?: ChatContextDto;
}
