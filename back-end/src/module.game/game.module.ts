import {forwardRef, Module} from '@nestjs/common';
import {GameController} from './game.controller';
import {GameService} from './game.service';
import {WebsocketGatewayGame} from './game.ws';
import {ServerGame} from './server/ServerGame';
import {UsersModule} from "../module.users/users.module";
import {GameEntity} from 'src/entities/game.entity';
import {TypeOrmModule} from '@nestjs/typeorm';
import {ChannelModule} from "../module.channels/channel.module";

@Module({
	controllers: [GameController],
	providers: [
		GameService,
		WebsocketGatewayGame,
		ServerGame,
	],
	imports: [
		TypeOrmModule.forFeature([GameEntity]),
		forwardRef(() => UsersModule),
		forwardRef(() => ChannelModule),
	]
})
export class GameModule {
}
