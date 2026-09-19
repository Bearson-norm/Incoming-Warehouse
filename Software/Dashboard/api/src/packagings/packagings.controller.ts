import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PackagingsService } from './packagings.service';
import { CreatePackagingDto } from './dto/create-packaging.dto';
import { UpdatePackagingDto } from './dto/update-packaging.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('packagings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PackagingsController {
  constructor(private readonly packagingsService: PackagingsService) {}

  @Post()
  @Roles('admin')
  create(@Body() createPackagingDto: CreatePackagingDto) {
    return this.packagingsService.create(createPackagingDto);
  }

  @Get()
  findAll(@Query('vendorId') vendorId?: string) {
    if (vendorId) {
      return this.packagingsService.findByVendor(+vendorId);
    }
    return this.packagingsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.packagingsService.findOne(+id);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() updatePackagingDto: UpdatePackagingDto) {
    return this.packagingsService.update(+id, updatePackagingDto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.packagingsService.remove(+id);
  }
}
