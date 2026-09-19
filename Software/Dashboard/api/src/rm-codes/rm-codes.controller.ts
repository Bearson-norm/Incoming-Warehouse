import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { RmCodesService } from './rm-codes.service';
import { CreateRmCodeDto } from './dto/create-rm-code.dto';
import { UpdateRmCodeDto } from './dto/update-rm-code.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('rm-codes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RmCodesController {
  constructor(private readonly rmCodesService: RmCodesService) {}

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateRmCodeDto) {
    return this.rmCodesService.create(dto);
  }

  @Get()
  findAll() {
    return this.rmCodesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rmCodesService.findOne(+id);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateRmCodeDto) {
    return this.rmCodesService.update(+id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.rmCodesService.remove(+id);
  }
}
