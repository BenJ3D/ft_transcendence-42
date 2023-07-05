import {
	BaseEntity,
	Column,
	Entity,
	OneToMany,
	PrimaryGeneratedColumn,
} from 'typeorm';

export enum UserStatus {
	ONLINE = 1,
	OFFLINE = 0,
}

@Entity('test')
export class User extends BaseEntity {
	@PrimaryGeneratedColumn()
	id_users: number;

	@Column({
		type: 'varchar',
		length: 12,
	})
	username: string;

	// Todo: comeback later to proper storage
	@Column({
		type: 'varchar',
		length: 256,
		default: null,
		nullable: true,
	})
	avatar_path: string;

	@Column({
		type: 'varchar',
		length: 100,
		default: null,
		nullable: true,
	})
	token_2fa: string;

	@Column({
		type: 'enum',
		enum: UserStatus,
		default: UserStatus.ONLINE,
	})
	status: UserStatus;

	// @OneToMany()
	// friend_list:
}
