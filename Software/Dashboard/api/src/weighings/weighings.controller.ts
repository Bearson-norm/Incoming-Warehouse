import { Controller, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { WeighingsService } from './weighings.service';
import { ConfirmWeighingDto } from './dto/confirm-weighing.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('weighings')
@UseGuards(JwtAuthGuard)
export class WeighingsController {
  constructor(private readonly weighingsService: WeighingsService) {}

  @Post('confirm')
  confirm(@Request() req, @Body() dto: ConfirmWeighingDto) {
    return this.weighingsService.confirm(req.user.userId, dto);
  }

  @Post(':id/send-to-odoo')
  sendToOdoo(@Request() req, @Param('id') id: string) {
    return this.weighingsService.sendToOdoo(req.user.userId, +id);
  }
}
