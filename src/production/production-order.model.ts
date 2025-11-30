import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { ApiProperty } from '@nestjs/swagger';

export enum ProductionStatus {
  RECEIVED = 'RECEIVED',
  PREPARING = 'PREPARING',
  DONE = 'DONE',
  DELIVERED = 'DELIVERED',
}

@Table({ tableName: 'production_orders' })
export class ProductionOrder extends Model {
  @ApiProperty({ example: 'uuid-v4', description: 'Unique identifier' })
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @ApiProperty({ example: 'ORDER-123', description: 'External order ID from Orders Service' })
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare externalOrderId: string;

  @ApiProperty({ example: [{ name: 'Burger', quantity: 1 }], description: 'List of items to prepare' })
  @Column({
    type: DataType.JSON,
    allowNull: false,
  })
  declare items: any;

  @ApiProperty({ enum: ProductionStatus, example: ProductionStatus.RECEIVED })
  @Column({
    type: DataType.ENUM(...Object.values(ProductionStatus)),
    defaultValue: ProductionStatus.RECEIVED,
    allowNull: false,
  })
  declare status: ProductionStatus;
}
