import { Test, TestingModule } from '@nestjs/testing';
import { SqsConsumerService } from './sqs-consumer.service';
import { ProductionService } from '../production/production.service';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';

describe('SqsConsumerService', () => {
  let service: SqsConsumerService;
  let productionService: ProductionService;
  const sqsMock = mockClient(SQSClient);

  beforeEach(async () => {
    sqsMock.reset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SqsConsumerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'AWS_REGION') return 'us-east-1';
              if (key === 'AWS_ACCESS_KEY_ID') return 'test-id';
              if (key === 'AWS_SECRET_ACCESS_KEY') return 'test-secret';
              if (key === 'AWS_SQS_QUEUE_URL') return 'http://test-queue';
              return null;
            }),
          },
        },
        {
          provide: ProductionService,
          useValue: {
            receiveOrder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SqsConsumerService>(SqsConsumerService);
    productionService = module.get<ProductionService>(ProductionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleMessage', () => {
    it('should parse valid JSON message and process order', async () => {
      const messageBody = JSON.stringify({
        externalOrderId: 'ORDER-123',
        items: [{ name: 'Burger', quantity: 1 }],
      });
      const message = {
        MessageId: 'msg-1',
        ReceiptHandle: 'handle-1',
        Body: messageBody,
      };

      // Mock SQS receive (though handleMessage is private, we can test logic via a "simulated" call if we want,
      // or we can test private method by casting to any)
      // For better testing, let's expose handleMessage as public for testing or invoke it via pollMessages logic.
      // But invoking pollMessages involves an infinite loop which is hard to test.
      // Best approach for unit testing logic: Call the private method directly (using any)

      sqsMock.on(DeleteMessageCommand).resolves({});
      (productionService.receiveOrder as jest.Mock).mockResolvedValue({});

      await (service as any).handleMessage(message);

      expect(productionService.receiveOrder).toHaveBeenCalledWith({
        externalOrderId: 'ORDER-123',
        items: [{ name: 'Burger', quantity: 1 }],
      });

      expect(sqsMock.calls()).toHaveLength(1);
      const deleteCommand = sqsMock.call(0).args[0] as DeleteMessageCommand;
      expect(deleteCommand.input.QueueUrl).toBe('http://test-queue');
      expect(deleteCommand.input.ReceiptHandle).toBe('handle-1');
    });

    it('should parse SNS notification wrapped message', async () => {
      const innerMessage = JSON.stringify({
        externalOrderId: 'ORDER-SNS',
        items: [{ name: 'Pizza', quantity: 2 }],
      });
      const body = JSON.stringify({
        Type: 'Notification',
        Message: innerMessage,
      });

      const message = {
        MessageId: 'msg-sns',
        ReceiptHandle: 'handle-sns',
        Body: body,
      };

      sqsMock.on(DeleteMessageCommand).resolves({});
      (productionService.receiveOrder as jest.Mock).mockResolvedValue({});

      await (service as any).handleMessage(message);

      expect(productionService.receiveOrder).toHaveBeenCalledWith({
        externalOrderId: 'ORDER-SNS',
        items: [{ name: 'Pizza', quantity: 2 }],
      });

      expect(sqsMock.calls()).toHaveLength(1); // Delete called
    });

    it('should handle invalid JSON gracefully (no crash, no delete)', async () => {
      const message = {
        MessageId: 'msg-invalid',
        ReceiptHandle: 'handle-invalid',
        Body: 'INVALID JSON',
      };

      await (service as any).handleMessage(message);

      expect(productionService.receiveOrder).not.toHaveBeenCalled();
      expect(sqsMock.calls()).toHaveLength(0); // Delete NOT called
    });

    it('should not delete message if processing fails', async () => {
      const message = {
        MessageId: 'msg-fail',
        ReceiptHandle: 'handle-fail',
        Body: JSON.stringify({ externalOrderId: 'FAIL' }),
      };

      (productionService.receiveOrder as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await (service as any).handleMessage(message);

      expect(productionService.receiveOrder).toHaveBeenCalled();
      expect(sqsMock.calls()).toHaveLength(0); // Delete NOT called
    });

    it('should log warning and return if message has no body', async () => {
      const message = {
        MessageId: 'msg-no-body',
        ReceiptHandle: 'handle-no-body',
      };

      const loggerSpy = jest.spyOn((service as any).logger, 'warn');

      await (service as any).handleMessage(message);

      expect(loggerSpy).toHaveBeenCalledWith(`Message msg-no-body has no body`);
      expect(productionService.receiveOrder).not.toHaveBeenCalled();
    });

    it('should use payload.Message as DTO if it is not a JSON string (SNS raw)', async () => {
      const innerMessageObj = {
        externalOrderId: 'ORDER-RAW',
        items: [{ name: 'Fries', quantity: 1 }],
      };
      // Payload.Message is an object, not a string
      const body = JSON.stringify({
        Type: 'Notification',
        Message: innerMessageObj,
      });

      const message = {
        MessageId: 'msg-raw-sns',
        ReceiptHandle: 'handle-raw-sns',
        Body: body,
      };

      sqsMock.on(DeleteMessageCommand).resolves({});
      (productionService.receiveOrder as jest.Mock).mockResolvedValue({});

      await (service as any).handleMessage(message);

      expect(productionService.receiveOrder).toHaveBeenCalledWith(innerMessageObj);
      expect(sqsMock.calls()).toHaveLength(1);
    });
  });

  describe('Initialization & Polling', () => {
    it('should NOT start polling if credentials are missing', async () => {
      const moduleVal: TestingModule = await Test.createTestingModule({
        providers: [
          SqsConsumerService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => null), // Return null for everything
            },
          },
          { provide: ProductionService, useValue: { receiveOrder: jest.fn() } },
        ],
      }).compile();

      const serviceNoConfig =
        moduleVal.get<SqsConsumerService>(SqsConsumerService);

      // We can't spy on logger here because constructor already ran
      // But we can verify sqsClient is undefined
      expect((serviceNoConfig as any).sqsClient).toBeUndefined();

      // onModuleInit shouldn't do anything
      serviceNoConfig.onModuleInit();
      expect((serviceNoConfig as any).isPolling).toBe(false);
    });

    it('should start polling on init and process messages', async () => {
      jest.useFakeTimers();
      const message = {
        MessageId: 'msg-poll',
        ReceiptHandle: 'handle-poll',
        Body: JSON.stringify({ externalOrderId: 'POLL' }),
      };

      // Mock SQS to return a message once, then stop polling
      sqsMock.on(ReceiveMessageCommand).callsFake(async () => {
        // Stop polling after this call to break the loop
        (service as any).isPolling = false;
        return { Messages: [message] };
      });

      sqsMock.on(DeleteMessageCommand).resolves({});
      (productionService.receiveOrder as jest.Mock).mockResolvedValue({});

      // Start
      service.onModuleInit();

      // Fast-forward timers to handle potential waits (though our mock returns immediately)
      // pollMessages is async, so we need to wait for the promise loop to handle the message
      await jest.runAllTimersAsync();

      expect(productionService.receiveOrder).toHaveBeenCalled();
      expect(sqsMock.commandCalls(ReceiveMessageCommand).length).toBeGreaterThan(
        0,
      );
      jest.useRealTimers();
    });

    it('should handle polling errors gracefully (retry wait)', async () => {
      jest.useFakeTimers();
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      // First call throws error
      // Second call stops polling
      let callCount = 0;
      sqsMock.on(ReceiveMessageCommand).callsFake(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('SQS Error');
        }
        (service as any).isPolling = false;
        return { Messages: [] };
      });

      const pollPromise = service.onModuleInit(); // Starts loop

      // Advance timers to cover the "wait after error" (5000ms)
      await jest.advanceTimersByTimeAsync(6000);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Error polling messages from SQS',
        expect.any(Error),
      );
      // Ensure we stop polling so the loop terminates cleanly
      (service as any).isPolling = false;

      // Wait for loop to finish
      await pollPromise;

      expect(callCount).toBeGreaterThanOrEqual(2);
      jest.useRealTimers();
    });
  });

  describe('Graceful Shutdown', () => {
    it('should switch polling off on destroy', () => {
      service.onModuleDestroy();
      expect((service as any).isPolling).toBe(false);
    });

    it('should wait for active messages in beforeApplicationShutdown', async () => {
      // This is a bit tricky to mock perfectly with setTimeout in test env,
      // but we can verify the logic by manipulating activeMessages manually.

      (service as any).activeMessages = 1;

      // Start shutdown in background
      const shutdownPromise = service.beforeApplicationShutdown('SIGTERM');

      // Simulate message finishing after 500ms
      setTimeout(() => {
        (service as any).activeMessages = 0;
      }, 500);

      await shutdownPromise;

      expect((service as any).activeMessages).toBe(0);
      expect((service as any).isPolling).toBe(false);
    });

    it('should timeout and force shutdown if messages take too long', async () => {
      (service as any).activeMessages = 1;
      const loggerSpy = jest.spyOn((service as any).logger, 'warn');

      // Reduce loop iterations for test to make it faster if possible,
      // but loop logic uses constant 'maxRetries = 10' and '1000' ms wait.
      // Total wait = 10s.
      // Jest fake timers can help.
      jest.useFakeTimers();

      const shutdownPromise = service.beforeApplicationShutdown('SIGTERM');

      // Fast forward past the 10 retries * 1000ms
      await jest.advanceTimersByTimeAsync(11000);

      await shutdownPromise;

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Forced shutdown with 1 active messages')
      );
      jest.useRealTimers();
    });
  });
});
