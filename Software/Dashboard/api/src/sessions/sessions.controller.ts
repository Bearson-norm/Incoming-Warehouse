import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  create(@Request() req, @Body() createSessionDto: CreateSessionDto) {
    return this.sessionsService.create(req.user.userId, createSessionDto);
  }

  @Get()
  findAll(@Request() req, @Query('userId') userId?: string) {
    const isAdmin = req.user.role === 'admin';
    const targetUserId =
      isAdmin && userId ? +userId : req.user.userId;
    return this.sessionsService.findAll(targetUserId);
  }

  @Get('active')
  findActive(@Request() req, @Query('flowType') flowType?: string) {
    return this.sessionsService.findActive(req.user.userId, flowType);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.sessionsService.findOne(+id, {
      userId: req.user.userId,
      role: req.user.role,
    });
  }

  @Patch(':id/start-weighing')
  startWeighing(@Param('id') id: string, @Request() req) {
    return this.sessionsService.startWeighing(+id, req.user.userId);
  }

  @Patch(':id/end')
  end(@Param('id') id: string, @Request() req) {
    return this.sessionsService.end(+id, req.user.userId);
  }
}
