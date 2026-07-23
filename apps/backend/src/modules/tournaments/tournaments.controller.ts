import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

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

  @Get(':id/matches')
  findMatches(@Param('id') id: string) {
    return this.tournamentsService.findMatches(id);
  }

  // ===== СУДЬИ (referees) =====

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/referee-invite')
  async generateRefereeInvite(@Param('id') id: string) {
    return this.tournamentsService.generateRefereeInvite(id);
  }

  @Get(':id/referees')
  async getReferees(@Param('id') id: string) {
    return this.tournamentsService.getReferees(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id/referees/:userId')
  async removeReferee(@Param('id') id: string, @Param('userId') userId: string) {
    return this.tournamentsService.removeReferee(id, userId);
  }

  /** Принять приглашение стать судьёй — любой авторизованный пользователь. */
  @UseGuards(JwtAuthGuard)
  @Post('referee-invite/:token/accept')
  async acceptRefereeInvite(@Param('token') token: string, @Req() req: any) {
    return this.tournamentsService.acceptRefereeInvite(token, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  create(@Body() data: any) {
    return this.tournamentsService.create(data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.tournamentsService.update(id, data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.tournamentsService.delete(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('groups/:groupId/bracket/generate')
  async generateBracket(@Param('groupId') groupId: string) {
    return this.tournamentsService.generateBracket(groupId);
  }

  @Get('groups/:groupId/bracket')
  async getBracket(@Param('groupId') groupId: string) {
    return this.tournamentsService.getBracket(groupId);
  }
}
