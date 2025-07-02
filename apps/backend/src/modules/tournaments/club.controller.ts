import { Controller, Get, Param, Post, Put, Delete, Body, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClubDocument } from './club.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
  @UseGuards(JwtAuthGuard)
  async create(@Body() body: { name: string }) {
    return this.clubModel.create({ name: body.name });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() body: { name: string }) {
    return this.clubModel.findByIdAndUpdate(id, { name: body.name }, { new: true });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string) {
    return this.clubModel.findByIdAndDelete(id);
  }
} 