import { Controller, Get, Param, Post, Put, Delete, Body, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClubDocument } from './club.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('clubs')
export class ClubController {
  constructor(
    @InjectModel('Club') private clubModel: Model<ClubDocument>,
  ) {}

  @Get()
  async findAll() {
    return this.clubModel.find().exec();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.clubModel.findById(id).exec();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() body: { name: string }) {
    return this.clubModel.create({ name: body.name });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(@Param('id') id: string, @Body() body: { name: string }) {
    return this.clubModel.findByIdAndUpdate(id, { name: body.name }, { new: true });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async delete(@Param('id') id: string) {
    return this.clubModel.findByIdAndDelete(id);
  }
} 