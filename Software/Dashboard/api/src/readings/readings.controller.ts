import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ReadingsService } from './readings.service';
import { QueryReadingsDto } from './dto/query-readings.dto';
import { CreateReadingDto } from './dto/create-reading.dto';
import { UpdateReadingLabelDto } from './dto/update-reading-label.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('readings')
@UseGuards(JwtAuthGuard)
export class ReadingsController {
  constructor(private readonly readingsService: ReadingsService) {}

  @Get()
  findAll(@Query() query: QueryReadingsDto, @Request() req) {
    return this.readingsService.findAll(query, {
      userId: req.user.userId,
      role: req.user.role,
    });
  }

  @Get('stats')
  stats(@Query() query: QueryReadingsDto, @Request() req) {
    return this.readingsService.stats(query, {
      userId: req.user.userId,
      role: req.user.role,
    });
  }

  @Get('by-lpn')
  findByLpn(@Query('packageUid') packageUid: string, @Request() req) {
    return this.readingsService.findByLpn(packageUid, {
      userId: req.user.userId,
      role: req.user.role,
    });
  }

  @Post()
  create(@Request() req, @Body() createReadingDto: CreateReadingDto) {
    return this.readingsService.create(createReadingDto, req.user.userId);
  }

  @Patch(':id/label')
  updateLabel(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateReadingLabelDto,
  ) {
    return this.readingsService.updateLabel(+id, dto, {
      userId: req.user.userId,
      role: req.user.role,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.readingsService.findOne(+id, {
      userId: req.user.userId,
      role: req.user.role,
    });
  }
}
