import { Module } from '@nestjs/common';
import { ProductionService } from './production.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { ProductionOrder } from './production-order.model';
import { ProductionController } from './production.controller';

@Module({
  imports: [SequelizeModule.forFeature([ProductionOrder])],
  providers: [ProductionService],
  controllers: [ProductionController],
  exports: [ProductionService],
})
export class ProductionModule { }
