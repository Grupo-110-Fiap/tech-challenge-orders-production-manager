import { Test, TestingModule } from '@nestjs/testing';
import { ProductionService } from './production.service';
import { getModelToken } from '@nestjs/sequelize';
import { ProductionOrder, ProductionStatus } from './production-order.model';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockProductionOrder = {
  id: 'uuid',
  status: ProductionStatus.RECEIVED,
  save: jest.fn(),
};

const mockProductionOrderModel = {
  findAll: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn(),
};

describe('ProductionService', () => {
  let service: ProductionService;

  beforeEach(async () => {
    jest.clearAllMocks();
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listPendingOrders', () => {
    it('should return pending orders', async () => {
      const result = [mockProductionOrder];
      mockProductionOrderModel.findAll.mockResolvedValue(result);

      expect(await service.listPendingOrders()).toBe(result);
      expect(mockProductionOrderModel.findAll).toHaveBeenCalledWith({
        where: {
          status: [
            ProductionStatus.RECEIVED,
            ProductionStatus.PREPARING,
            ProductionStatus.DONE,
          ],
        },
        order: [['createdAt', 'ASC']],
      });
    });
  });

  describe('updateStatus', () => {
    it('should update status for valid transition', async () => {
      mockProductionOrderModel.findByPk.mockResolvedValue({
        ...mockProductionOrder,
        status: ProductionStatus.RECEIVED,
        save: jest.fn().mockResolvedValue({
          ...mockProductionOrder,
          status: ProductionStatus.PREPARING,
        }),
      });

      const result = await service.updateStatus(
        'uuid',
        ProductionStatus.PREPARING,
      );
      expect(result.status).toBe(ProductionStatus.PREPARING);
    });

    it('should throw BadRequestException for invalid transition', async () => {
      mockProductionOrderModel.findByPk.mockResolvedValue({
        ...mockProductionOrder,
        status: ProductionStatus.RECEIVED,
      });

      await expect(
        service.updateStatus('uuid', ProductionStatus.DONE),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if order not found', async () => {
      mockProductionOrderModel.findByPk.mockResolvedValue(null);

      await expect(
        service.updateStatus('uuid', ProductionStatus.PREPARING),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('receiveOrder', () => {
    it('should create a new order if it does not exist', async () => {
      const dto = {
        externalOrderId: 'EXT-123',
        items: [{ name: 'Burger', quantity: 1 }],
      };

      mockProductionOrderModel.findOne.mockResolvedValue(null);
      mockProductionOrderModel.create.mockResolvedValue({
        id: 'new-id',
        ...dto,
        status: ProductionStatus.RECEIVED,
      });

      const result = await service.receiveOrder(dto);

      expect(mockProductionOrderModel.findOne).toHaveBeenCalledWith({
        where: { externalOrderId: dto.externalOrderId },
      });
      expect(mockProductionOrderModel.create).toHaveBeenCalledWith({
        externalOrderId: dto.externalOrderId,
        items: dto.items,
        status: ProductionStatus.RECEIVED,
      });
      expect(result.id).toBe('new-id');
    });

    it('should return existing order if it already exists (idempotency)', async () => {
      const dto = {
        externalOrderId: 'EXT-EXISTING',
        items: [{ name: 'Pizza', quantity: 2 }],
      };

      const existingOrder = {
        id: 'existing-id',
        ...dto,
        status: ProductionStatus.RECEIVED,
      };
      mockProductionOrderModel.findOne.mockResolvedValue(existingOrder);

      const result = await service.receiveOrder(dto);

      expect(mockProductionOrderModel.findOne).toHaveBeenCalledWith({
        where: { externalOrderId: dto.externalOrderId },
      });
      expect(mockProductionOrderModel.create).not.toHaveBeenCalled();
      expect(result).toBe(existingOrder);
    });
  });
});
