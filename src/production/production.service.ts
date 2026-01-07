import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ProductionOrder, ProductionStatus } from './production-order.model';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';

@Injectable()
export class ProductionService {
  constructor(
    @InjectModel(ProductionOrder)
    private productionOrderModel: typeof ProductionOrder,
  ) { }

  async receiveOrder(dto: CreateProductionOrderDto): Promise<ProductionOrder> {
    const existingOrder = await this.productionOrderModel.findOne({
      where: { externalOrderId: dto.externalOrderId },
    });

    if (existingOrder) {
      // Idempotency: if order already exists, just return it (or ignore)
      return existingOrder;
    }

    return this.productionOrderModel.create({
      externalOrderId: dto.externalOrderId,
      items: dto.items,
      status: ProductionStatus.RECEIVED,
    });
  }

  async listPendingOrders(): Promise<ProductionOrder[]> {
    return this.productionOrderModel.findAll({
      where: {
        status: [ProductionStatus.RECEIVED, ProductionStatus.PREPARING, ProductionStatus.DONE],
      },
      order: [['createdAt', 'ASC']],
    });
  }

  async updateStatus(id: string, newStatus: ProductionStatus): Promise<ProductionOrder> {
    const order = await this.productionOrderModel.findByPk(id);

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    this.validateStatusTransition(order.status, newStatus);

    order.status = newStatus;
    return order.save();
  }

  private validateStatusTransition(currentStatus: ProductionStatus, newStatus: ProductionStatus): void {
    const validTransitions: Record<ProductionStatus, ProductionStatus[]> = {
      [ProductionStatus.RECEIVED]: [ProductionStatus.PREPARING],
      [ProductionStatus.PREPARING]: [ProductionStatus.DONE],
      [ProductionStatus.DONE]: [ProductionStatus.DELIVERED],
      [ProductionStatus.DELIVERED]: [],
    };

    const allowed = validTransitions[currentStatus];

    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}. Allowed: ${allowed.join(', ')}`,
      );
    }
  }
}
