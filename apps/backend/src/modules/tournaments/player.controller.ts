import { Controller, Get, Param, Post, Put, Delete, Body, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PlayerDocument } from './player.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { File as MulterFile } from 'multer';
import * as path from 'path';

@Controller('players')
export class PlayerController {
  constructor(
    @InjectModel('Player') private playerModel: Model<PlayerDocument>,
  ) {}

  @Get()
  async findAll() {
    return this.playerModel.find().exec();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.playerModel.findById(id).exec();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() body: any) {
    return this.playerModel.create(body);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() body: any) {
    return this.playerModel.findByIdAndUpdate(id, body, { new: true });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string) {
    return this.playerModel.findByIdAndDelete(id);
  }

  @Post(':id/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar', {
    storage: diskStorage({
      destination: './player_photos',
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `player_${req.params.id}_${Date.now()}${ext}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files are allowed!'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  }))
  async uploadAvatar(@Param('id') id: string, @UploadedFile() file: MulterFile) {
    if (!file) throw new Error('No file uploaded');
    const photoUrl = `/player_photos/${file.filename}`;
    await this.playerModel.findByIdAndUpdate(id, { photoUrl });
    return { photoUrl };
  }

  @Delete(':id/avatar')
  @UseGuards(JwtAuthGuard)
  async deleteAvatar(@Param('id') id: string) {
    await this.playerModel.findByIdAndUpdate(id, { photoUrl: '' });
    return { success: true };
  }
} 