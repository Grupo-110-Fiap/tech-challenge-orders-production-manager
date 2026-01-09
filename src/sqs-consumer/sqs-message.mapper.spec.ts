import { Test, TestingModule } from '@nestjs/testing';
import { SqsMessageMapper } from './sqs-message.mapper';

describe('SqsMessageMapper', () => {
  let mapper: SqsMessageMapper;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SqsMessageMapper],
    }).compile();

    mapper = module.get<SqsMessageMapper>(SqsMessageMapper);
  });

  it('should be defined', () => {
    expect(mapper).toBeDefined();
  });

  it('should map definitive payload to DTO', () => {
    const messageBody = JSON.stringify({
      id: '550e8400-e29b-41d4-a716-446655440000',
      items: [{ product_id: 'prod_abc', quantity: 2, price: 50.00 }],
    });

    const result = mapper.mapToDto(messageBody);

    expect(result).toEqual({
      externalOrderId: '550e8400-e29b-41d4-a716-446655440000',
      items: [{ product_id: 'prod_abc', quantity: 2, price: 50.00 }],
    });
  });

  it('should map SNS wrapped message to DTO', () => {
    const innerMessage = JSON.stringify({
      id: 'ORDER-SNS',
      items: [{ product_id: 'pizza_123', quantity: 2, price: 30.00 }],
    });
    const messageBody = JSON.stringify({
      Type: 'Notification',
      Message: innerMessage,
    });

    const result = mapper.mapToDto(messageBody);

    expect(result).toEqual({
      externalOrderId: 'ORDER-SNS',
      items: [{ product_id: 'pizza_123', quantity: 2, price: 30.00 }],
    });
  });

  it('should return raw order if mapping fails (fallback)', () => {
    const payload = {
      externalOrderId: 'LEGACY-123',
      items: [{ name: 'Burger', quantity: 1 }],
    };
    const messageBody = JSON.stringify(payload);

    const result = mapper.mapToDto(messageBody);

    expect(result).toEqual(payload);
  });

  it('should return null if JSON is invalid', () => {
    const result = mapper.mapToDto('INVALID JSON');
    expect(result).toBeNull();
  });
});
