import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProductionModule } from '../production/production.module';
import { SqsConsumerService } from './sqs-consumer.service';
import { SqsMessageMapper } from './sqs-message.mapper';

@Module({
  imports: [ConfigModule, ProductionModule],
  providers: [SqsConsumerService, SqsMessageMapper],
})
export class SqsConsumerModule { }
