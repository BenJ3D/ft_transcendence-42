import {
	Body,
	Controller,
	Get,
	Param,
	Put,
	UseGuards,
	ParseIntPipe,
	BadRequestException,
	UseInterceptors,
	UploadedFile,
	HttpStatus,
	HttpCode,
	Post,
	Request,
	ValidationPipe,
} from '@nestjs/common';
import {UsersService} from './users.service';
import {UpdateUserDto} from '../dto.pipe/update-user.dto';
import {AuthGuard} from '../module.auth/auth.guard';
import {UserEntity} from "../entities/user.entity";
import {CurrentUser} from '../module.auth/indentify.user';
import {InviteService} from "../module.channels/invite.service";
import {ChatGateway} from "../module.channels/chat.ws";
import {ChannelService} from "../module.channels/channel.service";
import {FileInterceptor} from '@nestjs/platform-express/multer';
import {checkLimitID} from "../dto.pipe/checkIntData";

@Controller('users')
export class UsersController {
	constructor(
		private readonly usersService: UsersService,
		private readonly inviteService: InviteService,
		private readonly chatWsService: ChatGateway,
		private readonly channelService: ChannelService,
	) {
	}

	/** * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * ***/

	@Get('me')
	@UseGuards(AuthGuard)
	me(@CurrentUser() user: UserEntity) {
		return user;
	}

	@Get('/me/getRelationships')
	@UseGuards(AuthGuard)
	async meRelation(@CurrentUser() user: UserEntity) {
		return this.usersService.findOne(user.UserID, ['blocked', 'followers', 'subscribed']);
	}

	@Get('/get/Relationships/:UserID')
	@UseGuards(AuthGuard)
	async otherRelation(@Param('UserID', ParseIntPipe) targetID: number) {
		return this.usersService.findOne(targetID, ['blocked', 'followers', 'subscribed']);
	}

	@Get('/get/nicknameUsed/:nick')
	@UseGuards(AuthGuard)
	nickNameUsed(@Param('nick') nick: string) {
		return this.usersService.nicknameUsed(nick);
	}

	@Get('/get')
	@UseGuards(AuthGuard)
	findAll() {
		return this.usersService.findAll();
	}

	@Get('/get/:id')
	@UseGuards(AuthGuard)
	async findOneID(@Param('id', ParseIntPipe) id: number) {
		checkLimitID(id);
		return await this.usersService.findOne(id);
	}

	/**
	 * retourne la liste des channels join par le user
	 * @param user
	 * @returns
	 */
	@Get('channelJoined')
	@UseGuards(AuthGuard)
	async channelJoined(@CurrentUser() user: UserEntity) {
		return await this.channelService.getJoinedChannelList(user);
	}

	/*************************************************/

	@HttpCode(HttpStatus.OK)
	@Post('upload/avatar')
	@UseGuards(AuthGuard)
	@UseInterceptors(FileInterceptor('avatar'))
	async uploadAvatar(@CurrentUser() user: UserEntity, @UploadedFile() file, @Request() req) {
		return await this.usersService.uploadAvatar(user, file, req);
	}

	@Put('update')
	@UseGuards(AuthGuard)
	updateNickname(
		@CurrentUser() user: UserEntity,
		@Body(new ValidationPipe()) update: UpdateUserDto,
	) {
		return this.usersService.update(user, update);
	}

	@Get('invite/received')
	@UseGuards(AuthGuard)
	getInviteReceived(
		@CurrentUser() user: UserEntity,
	) {
		return this.inviteService.findAllReceivedUser(user);
	}

	@Get('invite/send')
	@UseGuards(AuthGuard)
	getInviteSend(
		@CurrentUser() user: UserEntity,
	) {
		return this.inviteService.findAllSendUser(user);
	}

	@Put('follow/:userID')
	@UseGuards(AuthGuard)
	async follow(
		@CurrentUser() user: UserEntity,
		@Param('userID') targetID: number,
	) {
		checkLimitID(targetID);
		if (targetID == user.UserID)
			throw new BadRequestException('You cannot follow Yourself');
		const target: UserEntity = await this.usersService.findOne(targetID);
		user = await this.usersService.findOne(user.UserID, ['subscribed', 'blocked'])
		if (user.subscribed.findIndex(usr => usr.UserID === target.UserID) + 1)
			throw new BadRequestException('You already following that user');
		if (!!user.blocked.find(targ => targ.UserID == target.UserID))
			throw new BadRequestException('You block this user');
		user.subscribed.push(target);
		await user.save();
		await this.chatWsService.EventNotif(target, 'info', `The User ${user.login} started Followed you`);
	}

	@Put('unfollow/:userID')
	@UseGuards(AuthGuard)
	async unfollow(
		@CurrentUser() user: UserEntity,
		@Param('userID', ParseIntPipe) targetID: number,
	) {
		checkLimitID(targetID);
		const target: UserEntity = await this.usersService.findOne(targetID);
		user = await this.usersService.findOne(user.UserID, ['subscribed'])
		let index = user.subscribed.findIndex(usr => usr.UserID === target.UserID) + 1;
		if (!index)
			throw new BadRequestException('You aren\'t following that user');
		user.subscribed = user.subscribed.filter(usr => usr.UserID !== target.UserID);
		await user.save();
		await this.chatWsService.EventNotif(target, 'info', `The User ${user.login} stopped Unfollowed you`);
	}

	@Get('mysubs')
	@UseGuards(AuthGuard)
	async getSubscription(
		@CurrentUser() user: UserEntity
	) {
		return this.usersService.findOne(user.UserID, ['subscribed']).then(user => user.subscribed);
	}

	@Get('myfollow')
	@UseGuards(AuthGuard)
	async getFollowers(
		@CurrentUser() user: UserEntity
	) {
		return this.usersService.findOne(user.UserID, ['followers']).then(user => user.followers);
	}

	@Put('block/:userID')
	@UseGuards(AuthGuard)
	async blockUser(
		@CurrentUser() user: UserEntity,
		@Param('userID', ParseIntPipe) targetID: number,
	) {
		checkLimitID(targetID);
		if (targetID == user.UserID)
			throw new BadRequestException('Don\'t try to block yourself plz ...');
		const target = await this.usersService.findOne(targetID);
		user = await this.usersService.findOne(user.UserID, ['blocked', 'subscribed']);
		if (user.blocked.find(block => block.UserID == target.UserID))
			throw new BadRequestException('You already have blocked this user');
		if (!!user.subscribed.find(targ => targ.UserID == target.UserID))
			user.subscribed = user.subscribed.filter(targ => targ.UserID !== target.UserID);
		await this.chatWsService.block(user, target);
		return this.usersService.blockUser(user, target);
	}

	@Put('unblock/:userID')
	@UseGuards(AuthGuard)
	async unBlockUser(
		@CurrentUser() user: UserEntity,
		@Param('userID', ParseIntPipe) targetID: number,
	) {
		checkLimitID(targetID);
		if (targetID == user.UserID)
			throw new BadRequestException('Yeah you can accept yourself now ?');
		const target = await this.usersService.findOne(targetID);
		user = await this.usersService.findOne(user.UserID, ['blocked']);
		if (!user.blocked.find(block => block.UserID == target.UserID))
			throw new BadRequestException('You haven\'t block this user yet');
		await this.chatWsService.unblock(user, target);
		return this.usersService.unBlockUser(user, target);
	}

	@Get('block')
	@UseGuards(AuthGuard)
	async blockedUser(
		@CurrentUser() user: UserEntity,
	) {
		return this.usersService.findOne(user.UserID, ['blocked']).then(user => user.blocked);
	}
}
