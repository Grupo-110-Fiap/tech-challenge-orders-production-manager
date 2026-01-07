import { IsNotEmpty, IsString, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductionOrderDto {
  @ApiProperty({ example: 'ORDER-123' })
  @IsString()
  @IsNotEmpty()
  externalOrderId: string;

  @ApiProperty({ example: [{ name: 'Burger', quantity: 1 }] })
  @IsArray()
  @IsNotEmpty()
  items: any[];
}
