import { IsEnum } from 'class-validator';
import { ProductionStatus } from '../production-order.model';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateStatusDto {
  @ApiProperty({
    enum: ProductionStatus,
    description: 'The new status of the order',
    example: ProductionStatus.PREPARING,
  })
  @IsEnum(ProductionStatus, {
    message: `Status must be one of: ${Object.values(ProductionStatus).join(', ')}`,
  })
  status: ProductionStatus;
}
