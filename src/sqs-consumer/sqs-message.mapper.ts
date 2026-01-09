import { Injectable, Logger } from '@nestjs/common';
import { CreateProductionOrderDto } from '../production/dto/create-production-order.dto';

@Injectable()
export class SqsMessageMapper {
  private readonly logger = new Logger(SqsMessageMapper.name);

  mapToDto(messageBody: string): CreateProductionOrderDto | null {
    try {
      const payload = JSON.parse(messageBody);
      const rawOrder = this.extractRawOrder(payload);

      if (rawOrder?.id && rawOrder?.items) {
        return {
          externalOrderId: rawOrder.id,
          items: rawOrder.items,
        };
      }

      // Fallback for legacy format or already mapped objects
      return rawOrder;
    } catch (error) {
      this.logger.error(`Failed to parse message body: ${messageBody}`, error);
      return null;
    }
  }

  private extractRawOrder(payload: any): any {
    if (payload.Type === 'Notification' && payload.Message) {
      try {
        return typeof payload.Message === 'string'
          ? JSON.parse(payload.Message)
          : payload.Message;
      } catch (error) {
        this.logger.error(`Failed to parse SNS message content`, error);
        return payload.Message;
      }
    }
    return payload;
  }
}
