import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TournamentSchema } from './tournament.schema';
import { GroupSchema } from './group.schema';
import { PlayerSchema } from './player.schema';
import { ClubSchema } from './club.schema';
import { MatchSchema } from './match.schema';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { GroupsController } from './groups.controller';
import { ClubController } from './club.controller';
import { PlayerController } from './player.controller';
import { MatchController } from './match.controller';

@Module({
  imports: [MongooseModule.forFeature([
    { name: 'Tournament', schema: TournamentSchema },
    { name: 'Group', schema: GroupSchema },
    { name: 'Player', schema: PlayerSchema },
    { name: 'Club', schema: ClubSchema },
    { name: 'Match', schema: MatchSchema },
  ])],
  providers: [TournamentsService],
  controllers: [TournamentsController, GroupsController, ClubController, PlayerController, MatchController],
})
export class TournamentsModule {} 