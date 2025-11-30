import { Test, TestingModule } from '@nestjs/testing';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import { ProductionStatus } from './production-order.model';

const mockProductionOrder = {
  id: 'uuid',
  status: ProductionStatus.RECEIVED,
};

const mockProductionService = {
  listPendingOrders: jest.fn(),
  updateStatus: jest.fn(),
};

describe('ProductionController', () => {
  let controller: ProductionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductionController],
      providers: [
        {
          provide: ProductionService,
          useValue: mockProductionService,
        },
      ],
    }).compile();

    controller = module.get<ProductionController>(ProductionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listQueue', () => {
    it('should return pending orders', async () => {
      const result = [mockProductionOrder];
      mockProductionService.listPendingOrders.mockResolvedValue(result);

      expect(await controller.listQueue()).toBe(result);
      expect(mockProductionService.listPendingOrders).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('should update order status', async () => {
      const result = { ...mockProductionOrder, status: ProductionStatus.PREPARING };
      mockProductionService.updateStatus.mockResolvedValue(result);

      expect(await controller.updateStatus('uuid', { status: ProductionStatus.PREPARING })).toBe(result);
      expect(mockProductionService.updateStatus).toHaveBeenCalledWith('uuid', ProductionStatus.PREPARING);
    });
  });
});
