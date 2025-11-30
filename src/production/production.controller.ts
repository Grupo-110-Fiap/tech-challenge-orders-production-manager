import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ProductionService } from './production.service';
import { ProductionOrder } from './production-order.model';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Production')
@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) { }

  @Get('queue')
  @ApiOperation({ summary: 'List the production queue (orders to be prepared)' })
  @ApiResponse({ status: 200, description: 'List of pending orders', type: [ProductionOrder] })
  async listQueue(): Promise<ProductionOrder[]> {
    return this.productionService.listPendingOrders();
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update the status of a production order' })
  @ApiResponse({ status: 200, description: 'The updated order', type: ProductionOrder })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto,
  ): Promise<ProductionOrder> {
    return this.productionService.updateStatus(id, updateStatusDto.status);
  }
}
