import {
	BaseEntity,
	Column,
	Entity,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import {UserEntity} from './user.entity';
import {ChannelEntity} from './channel.entity';

@Entity('Messages')
export class MessageEntity extends BaseEntity {
	@PrimaryGeneratedColumn()
	id: number;

	@ManyToOne(() => UserEntity, (UserEntity) => UserEntity.message, {eager: true})
	author: UserEntity;

	@Column({
		type: 'timestamp',
	})
	sendTime: Date;

	@ManyToOne(() => ChannelEntity, (ChannelEntity) => ChannelEntity.messages)
	channel: ChannelEntity;

	@Column({
		type: 'varchar',
		length: 256,
		nullable: false,
	})
	content: string;
}
