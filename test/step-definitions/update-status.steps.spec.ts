import { loadFeature, defineFeature } from 'jest-cucumber';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductionService } from '../../src/production/production.service';
import { ProductionOrder, ProductionStatus } from '../../src/production/production-order.model';
import { getModelToken } from '@nestjs/sequelize';

const feature = loadFeature('./test/features/update-status.feature');

defineFeature(feature, (test) => {
  let service: ProductionService;
  let mockOrder: any;
  let updatedOrder: any;

  const mockProductionOrderModel = {
    findByPk: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionService,
        {
          provide: getModelToken(ProductionOrder),
          useValue: mockProductionOrderModel,
        },
      ],
    }).compile();

    service = module.get<ProductionService>(ProductionService);
  });

  test('Update status to PREPARING', ({ given, when, then }) => {
    given('a production order with status "RECEIVED" exists', async () => {
      mockOrder = {
        id: 'uuid',
        status: ProductionStatus.RECEIVED,
        save: jest.fn().mockImplementation(function () {
          return this;
        }),
      };
      mockProductionOrderModel.findByPk.mockResolvedValue(mockOrder);
    });

    when('I request to update the status to "PREPARING"', async () => {
      updatedOrder = await service.updateStatus('uuid', ProductionStatus.PREPARING);
    });

    then('the order status should be "PREPARING"', () => {
      expect(updatedOrder.status).toBe(ProductionStatus.PREPARING);
    });
  });
});
