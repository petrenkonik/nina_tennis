import { Controller, Get, Param } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MatchDocument } from './match.schema';

@Controller('matches')
export class MatchController {
  constructor(
    @InjectModel('Match') private matchModel: Model<MatchDocument>,
  ) {}

  @Get()
  async findAll() {
    return this.matchModel.find().exec();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.matchModel.findById(id).exec();
  }
} 