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
import { CreateProductionOrderDto } from '../production/dto/create-production-order.dto';

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
  ) {
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );
    this.queueUrl = this.configService.get<string>('AWS_SQS_QUEUE_URL');

    if (region && accessKeyId && secretAccessKey && this.queueUrl) {
      this.sqsClient = new SQSClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    } else {
      this.logger.warn(
        'AWS SQS credentials not found. SQS Consumer will not start.',
      );
    }
  }

  onModuleInit() {
    if (this.sqsClient) {
      this.isPolling = true;
      this.pollMessages();
    }
  }

  onModuleDestroy() {
    this.isPolling = false;
  }

  async beforeApplicationShutdown(signal?: string) {
    this.logger.log(`Received signal ${signal}. Starting graceful shutdown...`);
    this.isPolling = false;

    const maxRetries = 10;
    let retries = 0;

    while (this.activeMessages > 0 && retries < maxRetries) {
      this.logger.log(
        `Waiting for ${this.activeMessages} active messages to complete...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      retries++;
    }

    if (this.activeMessages > 0) {
      this.logger.warn(
        `Forced shutdown with ${this.activeMessages} active messages still processing.`,
      );
    } else {
      this.logger.log('All active messages processed. Shutdown complete.');
    }
  }

  private async pollMessages() {
    while (this.isPolling) {
      try {
        const command = new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20, // Long polling
          VisibilityTimeout: 30,
        });

        const response = await this.sqsClient.send(command);

        if (response.Messages && response.Messages.length > 0) {
          // Process messages concurrently but track them
          await Promise.all(
            response.Messages.map((message) => this.handleMessageSafely(message)),
          );
        }
      } catch (error) {
        if (this.isPolling) {
          this.logger.error('Error polling messages from SQS', error);
          // Wait a bit before retrying to avoid tight loops on error
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
      this.logger.log(`Received message: ${message.MessageId}`);
      if (!message.Body) {
        this.logger.warn(`Message ${message.MessageId} has no body`);
        return;
      }

      // Memory Management: Scope payload parsing to ensure GC can pick it up easily after function exit
      let orderDto: CreateProductionOrderDto | null = null;
      {
        let payload: any;
        try {
          payload = JSON.parse(message.Body);
        } catch (e) {
          this.logger.error(`Failed to parse message body: ${message.Body}`, e);
          return;
        }

        if (payload.Type === 'Notification' && payload.Message) {
          try {
            orderDto = JSON.parse(payload.Message);
          } catch (e) {
            orderDto = payload.Message;
          }
        } else {
          orderDto = payload;
        }
      }

      if (orderDto) {
        await this.productionService.receiveOrder(orderDto);
        this.logger.log(`Order processed successfully. Deleting message ${message.MessageId}`);

        await this.sqsClient.send(
          new DeleteMessageCommand({
            QueueUrl: this.queueUrl,
            ReceiptHandle: message.ReceiptHandle,
          }),
        );
      }
    } catch (error) {
      this.logger.error(`Error processing message ${message.MessageId}`, error);
      // Do NOT delete the message so it returns to the queue for retry
    }
  }
}
