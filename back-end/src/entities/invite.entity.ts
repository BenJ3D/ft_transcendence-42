import {
	BaseEntity,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import {UserEntity} from './user.entity';
import {ChannelEntity} from './channel.entity';

@Entity('Invites')
export class InviteEntity extends BaseEntity {
	@PrimaryGeneratedColumn()
	inviteID: number;

	@ManyToOne(() => UserEntity, (userEntity) => userEntity.invite, {eager: true})
	@JoinColumn()
	user: UserEntity;

	@ManyToOne(() => ChannelEntity, (channelEntity) => channelEntity.inviteList, {eager: true})
	@JoinColumn()
	channel: ChannelEntity;

	@ManyToOne(() => UserEntity, {eager: true})
	@JoinColumn()
	sender: UserEntity;
}
