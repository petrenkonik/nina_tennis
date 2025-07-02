import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get()
  findAll() {
    return this.tournamentsService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.tournamentsService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() data: any) {
    return this.tournamentsService.create(data);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() data: any) {
    return this.tournamentsService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id') id: string) {
    return this.tournamentsService.delete(id);
  }

  @Post('groups/:groupId/bracket/generate')
  async generateBracket(@Param('groupId') groupId: string) {
    return this.tournamentsService.generateBracket(groupId);
  }

  @Get('groups/:groupId/bracket')
  async getBracket(@Param('groupId') groupId: string) {
    return this.tournamentsService.getBracket(groupId);
  }
} 