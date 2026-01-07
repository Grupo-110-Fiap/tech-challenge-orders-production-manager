import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProductionModule } from '../production/production.module';
import { SqsConsumerService } from './sqs-consumer.service';

@Module({
  imports: [ConfigModule, ProductionModule],
  providers: [SqsConsumerService],
})
export class SqsConsumerModule { }
