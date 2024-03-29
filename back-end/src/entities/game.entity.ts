import {
	BaseEntity,
	Column,
	Entity,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import {UserEntity} from './user.entity';

@Entity('Games')
export class GameEntity extends BaseEntity {
	@PrimaryGeneratedColumn()
	ID: number;

	@ManyToOne(() => UserEntity)
	player1: UserEntity;

	@ManyToOne(() => UserEntity)
	player2: UserEntity;

	@Column()
	score1: number;

	@Column()
	score2: number;

	@Column({
		type: 'timestamp',
	})
	starting_date: Date;
}
