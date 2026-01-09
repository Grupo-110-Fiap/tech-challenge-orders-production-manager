import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  BeforeApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
} from '@aws-sdk/client-sqs';
import { ProductionService } from '../production/production.service';
import { SqsMessageMapper } from './sqs-message.mapper';

@Injectable()
export class SqsConsumerService
  implements OnModuleInit, OnModuleDestroy, BeforeApplicationShutdown {
  private readonly logger = new Logger(SqsConsumerService.name);
  private sqsClient: SQSClient;
  private queueUrl?: string;
  private isPolling = false;
  private activeMessages = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly productionService: ProductionService,
    private readonly messageMapper: SqsMessageMapper,
  ) {
    this.initializeSqsClient();
  }

  private initializeSqsClient() {
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    this.queueUrl = this.configService.get<string>('AWS_SQS_QUEUE_URL');

    if (region && accessKeyId && secretAccessKey && this.queueUrl) {
      this.sqsClient = new SQSClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.logger.warn('AWS SQS credentials not found. SQS Consumer will not start.');
    }
  }

  onModuleInit() {
    if (this.sqsClient) {
      this.isPolling = true;
      void this.pollMessages();
    }
  }

  onModuleDestroy() {
    this.isPolling = false;
  }

  async beforeApplicationShutdown(signal?: string) {
    this.logger.log(`Received signal ${signal}. Starting graceful shutdown...`);
    this.isPolling = false;

    await this.waitForActiveMessages();

    if (this.activeMessages > 0) {
      this.logger.warn(`Forced shutdown with ${this.activeMessages} active messages remaining.`);
    } else {
      this.logger.log('All active messages processed. Shutdown complete.');
    }
  }

  private async waitForActiveMessages() {
    const maxRetries = 10;
    for (let i = 0; i < maxRetries && this.activeMessages > 0; i++) {
      this.logger.log(`Waiting for ${this.activeMessages} active messages to complete...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  private async pollMessages() {
    while (this.isPolling) {
      try {
        const command = new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20,
          VisibilityTimeout: 30,
        });

        const response = await this.sqsClient.send(command);

        if (response.Messages?.length) {
          await Promise.all(
            response.Messages.map((msg) => this.handleMessageSafely(msg)),
          );
        }
      } catch (error) {
        if (this.isPolling) {
          this.logger.error('Error polling messages from SQS', error);
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    }
  }

  private async handleMessageSafely(message: Message) {
    this.activeMessages++;
    try {
      await this.handleMessage(message);
    } finally {
      this.activeMessages--;
    }
  }

  private async handleMessage(message: Message) {
    try {
      this.logger.log(`Processing message: ${message.MessageId}`);

      if (!message.Body) {
        this.logger.warn(`Message ${message.MessageId} has no body`);
        return;
      }

      const orderDto = this.messageMapper.mapToDto(message.Body);

      if (orderDto) {
        await this.productionService.receiveOrder(orderDto);
        await this.deleteMessage(message);
        this.logger.log(`Order processed successfully: ${message.MessageId}`);
      }
    } catch (error) {
      this.logger.error(`Error processing message ${message.MessageId}`, error);
    }
  }

  private async deleteMessage(message: Message) {
    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: message.ReceiptHandle,
    });
    await this.sqsClient.send(command);
  }
}
