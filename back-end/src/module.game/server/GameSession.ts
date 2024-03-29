import * as PODGAME from 'src/shared/typesGame';
import {EGameMod} from 'src/shared/typesGame';
import * as POD from 'src/shared/types';
import {Server, Socket} from 'socket.io';
import {wsGameRoutes} from 'src/shared/routesApi';
import {GameService} from '../game.service';


interface KeyPlayerState {
	isArrowDownPressed: boolean;
	isArrowUpPressed: boolean;
}

export class GameSession {
	private gameMod: PODGAME.EGameMod;
	private game_id: number;
	private gameRoomEvent: string;
	private initElements: PODGAME.ISizeGameElements;
	private infoGameSession: PODGAME.IGameSessionInfo;
	private startDate: Date;


	private ballDirection: PODGAME.IDirectionVec2D = {dx: 1, dy: 0}
	private fpsTargetInMs: number = 1000 / 60; // = 16.67ms = 60 fps
	private ballSpeedInitial: number;
	private ballSpeedMax: number = 5.9;
	private ballSpeed: number = 2.6;
	private ballAccelerationFactor: number = 1.18;
	private ballNumberHitBtwAcceleration: number = 3; //tous les X coup, la ball prend speed * AccelerationFactor
	private paddleAccelerationFactor: number = 1.1;
	private speedPaddleInitial: number;
	private speedPaddle: number = 4; // in pixel per move
	private hitCounter: number = 0;
	private scoreLimit: number = 5;
	private ghostZoneSizeInitial: number = 10; // % size ghostZone of total witdh/2
	private ghostZoneSize: number; // % of total witdh
	private ghostZoneSizeMax: number = 55; // % of total witdh
	private ghostZoneSizeCoef: number = 1.35; // coef agrandissement de la zone tous les [ballNumberHitBtwGhostZoneUp] coups
	private ballNumberHitBtwGhostZoneUp: number = 3; //tous les X coup, la ball prend speed * AccelerationFactor
	private rageQuit: boolean = false;

	// private trainningHit                  : number = 0;
	// private maxTrainningHit               : number = 0;


	///////////////////////  DEFINE FOR SIZE ELEMENTS ///////////////////////
	private classicPaddleSize: PODGAME.IVector2D = {y: 80, x: 10};
	private paddlePosMargin: number = 0.014; // % of the table // decalage barre du bord
	private table: Partial<PODGAME.IPodTable> = {
		positionBall: {x: 0, y: 0},
		sizeBall: {x: 12, y: 12},
		positionP1v: {x: 0, y: 0},
		positionP2v: {x: 0, y: 0},
		sizeP1: this.classicPaddleSize,
		sizeP2: this.classicPaddleSize,
		tableSize: {x: 700, y: 600}, //taille table server
		scoreP1: 0,
		scoreP2: 0,
		trainningHit: 0,
		maxTrainningHit: 0,
	};

	private serverSocket: Server;
	private player1: PODGAME.userInfoSocket;
	private player2: PODGAME.userInfoSocket;
	private spectator: PODGAME.userInfoSocket[];


	private lastPlayerScore: PODGAME.userInfoSocket | undefined = undefined;
	private winner: PODGAME.userInfoSocket;
	private looser: PODGAME.userInfoSocket;

	private isGameRunning: boolean = true;
	private isGameReady: boolean = false;
	private isP1Ready: boolean = false;
	private isP2Ready: boolean = false;

	private ballToRightDBG: boolean = true; // dbg => ball mouvement left / right for visual dbg


	private keyP1: KeyPlayerState = {
		isArrowDownPressed: false,
		isArrowUpPressed: false,
	};
	private keyP2: KeyPlayerState = {
		isArrowDownPressed: false,
		isArrowUpPressed: false,
	};
	private intervalId: NodeJS.Timeout;
	private intervalIdEmit: NodeJS.Timeout;

	private historyGame: POD.IGame; // pour push dans DB

	constructor(
		server: Server,
		P1: PODGAME.userInfoSocket,
		P2: PODGAME.userInfoSocket,
		startDate: Date,
		game_id: number,
		gameMod: PODGAME.EGameMod,
		gameSessionRoom: string,
		private gameService: GameService,
	) {
		this.gameMod = gameMod;
		this.ballSpeedInitial = this.ballSpeed;
		this.speedPaddleInitial = this.speedPaddle;
		this.player1 = P1;
		this.player2 = P2;
		this.startDate = startDate;
		this.gameRoomEvent = gameSessionRoom;
		this.serverSocket = server;
		this.table.positionBall = {
			x: (this.table.tableSize.x / 2) - (this.table.sizeBall.x / 2),
			y: (this.table.tableSize.y / 2) - -(this.table.sizeBall.y / 2),
		};
		if (this.gameMod === PODGAME.EGameMod.ghost) {
			this.ballSpeed *= 0.8;
			this.ballSpeedInitial = this.ballSpeed;
			this.ballSpeedMax = this.ballSpeedMax * 0.7;
			this.ghostZoneSize = this.ghostZoneSizeInitial;
		}

		//position de depart -- centrer en y
		this.table.positionP1v = {
			x: this.paddlePosMargin * this.table.tableSize.x,
			y: this.table.tableSize.y / 2 - this.table.sizeP1.y / 2
		};
		this.table.positionP2v = {
			x: this.table.tableSize.x - (this.paddlePosMargin * this.table.tableSize.x) - this.table.sizeP2.x,
			y: this.table.tableSize.y / 2 - this.table.sizeP2.y / 2
		};


		this.table.maxPosP1 = this.table.tableSize.y - this.table.sizeP1.y;
		this.table.maxPosP2 = this.table.tableSize.y - this.table.sizeP2.y;
		/*************************************************************************/
		/////////////////////SETUP TRAINNING GAME ////////////////////////////////
		/*************************************************************************/
		if (this.gameMod === PODGAME.EGameMod.trainning) {
			this.table.positionP1v = {x: 0, y: 0};
			this.table.sizeP1 = {x: this.table.tableSize.x * 0.02, y: this.table.tableSize.y};
			// this.player1.user.nickname = 'THE BIG WALL';
			this.scoreLimit = 5;
			// this.ballSpeedMax *= 1.2;
			// this.ballAccelerationFactor *= 0.9;
			// this.paddleAccelerationFactor *=1.0;
			// this.ballSpeedInitial = this.ballSpeedMax;
			// this.ballAccelerationFactor *= 0.8;
		} else {
			this.table.positionP1v = {
				x: this.paddlePosMargin * this.table.tableSize.x,
				y: this.table.tableSize.y / 2 - this.table.sizeP1.y / 2
			};

		}

		/*************************************************************************/
		/*************************************************************************/


		//////////INFO TABLE FOR SEND INIT MSG CLIENTS/PLAYER //////////////
		this.initElements = {
			tableServerSize: this.table.tableSize,
			ballSize: this.table.sizeBall,
			paddleP1Pos: this.table.positionP1v,
			paddleP2Pos: this.table.positionP2v,
			paddleP1Size: this.table.sizeP1,
			paddleP2Size: this.table.sizeP2,
		}

		this.infoGameSession = {
			game_id: game_id,
			gameName: this.gameRoomEvent,
			player1: P1.user,
			player2: P2.user,
			launchTime: startDate,
			startInitElement: this.initElements,
			ballIsHidden: false,
			gameMod: this.gameMod
		}


		//////////SETUP DES PLAYERS //////////////

		//j'inscrit les player a l'event de cette session
		if (gameMod !== PODGAME.EGameMod.trainning) {
			P1.socket.join(this.gameRoomEvent);
			P1.socket.emit('gameFind', {remoteEvent: `${this.gameRoomEvent}PLAYER1`});
			P1.socket.on(`${this.gameRoomEvent}ready`, () => {
				this.isP1Ready = true;
				this.startCountdownIfPlayersReady();
			})
		}

		P2.socket.join(this.gameRoomEvent);


		//j'envoi un nom d'event custom a chaque player sur lequel il vont emettre pour informer qu'il bouge
		P2.socket.emit('gameFind', {remoteEvent: `${this.gameRoomEvent}PLAYER2`});

		//les joueurs doivent cliquer sur ready pour commencer le game
		P2.socket.on(`${this.gameRoomEvent}ready`, () => {
			this.isP2Ready = true;
			this.startCountdownIfPlayersReady();
		})

		setTimeout(() => {
			if (this.isGameReady === false) {
				if (!this.isP1Ready)
					this.isP1Ready = true;
				if (!this.isP2Ready)
					this.isP2Ready = true;
				this.startCountdownIfPlayersReady();
			}
		}, 10000);

		if (this.gameMod !== PODGAME.EGameMod.trainning) {
			//j'ecoute leur propre event pour faire bouger leur paddle respectif
			P1.socket.on(`${this.gameRoomEvent}PLAYER1`, (data) => {
				if (data === PODGAME.EKeyEvent.arrowDownPressed) {
					// == touche BAS enfoncé
					this.keyP1.isArrowDownPressed = true;
				} else if (data === PODGAME.EKeyEvent.arrowDownRelease) {
					// == touche BAS relaché
					this.keyP1.isArrowDownPressed = false;
				} else if (data === PODGAME.EKeyEvent.arrowUpPressed) {
					// == touche HAUT enfoncé
					this.keyP1.isArrowUpPressed = true;
				} else if (data === PODGAME.EKeyEvent.arrowUpRelease) {
					// == touche HAUT relaché
					this.keyP1.isArrowUpPressed = false;
				}
			});
		}
		P2.socket.on(`${this.gameRoomEvent}PLAYER2`, (data) => {
			if (data === PODGAME.EKeyEvent.arrowDownPressed)
				// == touche BAS enfoncé
				this.keyP2.isArrowDownPressed = true;
			else if (data === PODGAME.EKeyEvent.arrowDownRelease)
				// == touche BAS relaché
				this.keyP2.isArrowDownPressed = false;
			else if (data === PODGAME.EKeyEvent.arrowUpPressed)
				// == touche HAUT enfoncé
				this.keyP2.isArrowUpPressed = true;
			else if (data === PODGAME.EKeyEvent.arrowUpRelease)
				// == touche HAUT relaché
				this.keyP2.isArrowUpPressed = false;
		});


		//DEV EVENT cheat goal system
		P1.socket.on(`${this.gameRoomEvent}GOAL`, () => {
			this.addGoalToPlayer(P1);
		});
		P2.socket.on(`${this.gameRoomEvent}GOAL`, () => {
			this.addGoalToPlayer(P2);
		});


		P1.socket.on(`${this.gameRoomEvent}STOP`, () => {
			if (this.table.scoreP1 < this.scoreLimit && this.table.scoreP2 < this.scoreLimit) {
				this.table.scoreP2 = this.scoreLimit;
				this.isEndGameCheckScoring();//faire gagner le joueur adverse
			}
		});
		P2.socket.on(`${this.gameRoomEvent}STOP`, () => {
			if (this.table.scoreP1 < this.scoreLimit && this.table.scoreP2 < this.scoreLimit) {
				this.table.scoreP1 = this.scoreLimit;
				this.isEndGameCheckScoring();//faire gagner le joueur adverse
			}
		});


		//petit message d'acceuil pour le debug et avertir que la game va commencer
		P1.socket.emit(
			'info',
			`GameSession: ${this.gameRoomEvent}\nVous jouer face a ${P2.user.nickname}`,
		);
		P2.socket.emit(
			'info',
			`GameSession: ${this.gameRoomEvent}\nVous jouer face a ${P1.user.nickname}`,
		);
		this.serverSocket
			.to(this.gameRoomEvent)
			.emit(
				'info',
				`Match qui va commencer : ${P1.user.nickname} vs ${P2.user.nickname}`,
			);
		this.serverSocket
			.to(this.gameRoomEvent)
			.emit(
				'infoGameSession',
				this.infoGameSession
			);
		this.sendUpdateTable(); //lancer setInterval table
	}

	private ghostModZoneManager = () => {
		const middleZoneSize: number = (this.table.tableSize.x / 2) * (this.ghostZoneSize / 100);
		let xZone: { min: number, max: number } = {
			min: (this.table.tableSize.x / 2) - middleZoneSize,
			max: (this.table.tableSize.x / 2) + middleZoneSize
		};
		if (this.table.positionBall.x > xZone.min && this.table.positionBall.x < xZone.max)
			this.table.ballIsHidden = true;
		else
			this.table.ballIsHidden = false;
		if (this.hitCounter % this.ballNumberHitBtwGhostZoneUp) {
			if (this.ghostZoneSize < this.ghostZoneSizeMax)
				this.ghostZoneSize *= this.ghostZoneSizeCoef;
			else
				this.ghostZoneSize = this.ghostZoneSizeMax;
			this.hitCounter = 0;
		}
	}


	private ballMouvement = () => {
		this.table.positionBall.x += this.ballSpeed * this.ballDirection.dx;
		this.table.positionBall.y += this.ballSpeed * this.ballDirection.dy;
		if (this.gameMod === PODGAME.EGameMod.ghost)
			this.ghostModZoneManager()
	}

	//calcul position des paddles en temp reel
	private positionManagement() {
		if (this.isGameRunning) {
			this.intervalId = setInterval(() => {
				if (this.keyP1.isArrowUpPressed) {
					if (this.table.positionP1v.y > 0)
						this.table.positionP1v.y -= this.speedPaddle;
				}
				if (this.keyP1.isArrowDownPressed) {
					if (this.table.positionP1v.y < this.table.maxPosP1)
						this.table.positionP1v.y += this.speedPaddle;
				}
				if (this.keyP2.isArrowUpPressed) {
					if (this.table.positionP2v.y > 0)
						this.table.positionP2v.y -= this.speedPaddle;
				}
				if (this.keyP2.isArrowDownPressed) {
					if (this.table.positionP2v.y < this.table.maxPosP2)
						this.table.positionP2v.y += this.speedPaddle;
				}
				this.playerSocketMonitoring();
				this.handleBallCollisions();
				this.ballMouvement();
			}, this.fpsTargetInMs / 2);
		}
	}

	//renvoyer la ball avec plus d'angle au plus on tape sur les extremitées des paddle
	private preciseCollPaddle(paddle: 'P1' | 'P2') {
		let collisionPoint: number;

		if (paddle === 'P1') {
			collisionPoint = this.table.positionBall.y + (this.table.sizeBall.y / 2) - this.table.positionP1v.y;
		} else {
			collisionPoint = this.table.positionBall.y + (this.table.sizeBall.y / 2) - this.table.positionP2v.y;
		}

		// Calculer la position relative de la balle sur le paddle.
		const relativeIntersectY = (collisionPoint / (paddle === 'P1' ? this.table.sizeP1.y : this.table.sizeP2.y)) - 0.5;

		// Convertir cette position relative de son angle dinversion
		const bounceAngle = relativeIntersectY * 4.5;

		this.ballDirection.dy = Math.sin(bounceAngle);
		this.ballDirection.dx = -this.ballDirection.dx;  // Inversez simplement la direction horizontale comme avant.
		this.ballSpeedManagement(); //accelere la balle
	}


	private ballSpeedManagement() {
		if (this.hitCounter % this.ballNumberHitBtwAcceleration === 0 && this.ballSpeed <= this.ballSpeedMax) {
			this.ballSpeed *= this.ballAccelerationFactor;
			this.speedPaddle *= this.paddleAccelerationFactor;
		}
	}

	private handleBallCollisions() {
		const ballPos = this.table.positionBall;
		const ballSize = this.table.sizeBall;
		const P1pos = this.table.positionP1v;
		const P1Size = this.table.sizeP1;
		const P2pos = this.table.positionP2v;
		const P2Size = this.table.sizeP2;
		const tableSize = this.table.tableSize;

		// Collision avec le haut ou le bas
		if (ballPos.y <= 0 || (ballPos.y + ballSize.y) >= tableSize.y) {
			this.ballDirection.dy = -this.ballDirection.dy;

			//empecher la balle de filer droit sur les bords haut/bas
			if (ballPos.y <= 0 && this.ballDirection.dy < 0.01) {
				this.table.positionBall.y = 0;
				this.ballDirection.dy = 0.01
			} else if ((ballPos.y + ballSize.y) >= this.table.tableSize.y && this.ballDirection.dy > -0.01) {
				this.table.positionBall.y = this.table.tableSize.y - this.table.sizeBall.y;
				this.ballDirection.dy = -0.01
			}
		}

		// Collision avec paddle P1
		if (ballPos.x <= P1pos.x + P1Size.x &&
			ballPos.x + (ballSize.x / 2) >= P1pos.x &&
			ballPos.y + ballSize.y >= P1pos.y &&
			ballPos.y <= P1pos.y + P1Size.y) {
			if (ballPos.x + (ballSize.x / 2) >= P1pos.x)
				ballPos.x = P1pos.x + P1Size.x;
			this.preciseCollPaddle('P1');
			this.hitCounter++;

		}

		// Collision avec paddle P2
		else if (ballPos.x + ballSize.x >= P2pos.x &&
			ballPos.x + (ballSize.x / 2) <= P2pos.x + P2Size.x &&
			ballPos.y + ballSize.y >= P2pos.y &&
			ballPos.y <= P2pos.y + P2Size.y) {
			if (ballPos.x - (ballSize.x / 2) <= P2pos.x + P2Size.x)
				ballPos.x = P2pos.x - ballSize.x;
			this.preciseCollPaddle('P2');
			this.hitCounter++;
			this.table.trainningHit++;
			if (this.table.trainningHit > this.table.maxTrainningHit)
				this.table.maxTrainningHit = this.table.trainningHit;
			// this.ballDirection.dx = -this.ballDirection.dx;
		}


		// Collision avec les rebords gauche droite => GOAL
		if (ballPos.x <= 0)
			this.addGoalToPlayer(this.player2);
		if (ballPos.x >= tableSize.x)
			this.addGoalToPlayer(this.player1);
	}


	//envoi update au front des elements de la table
	private sendUpdateTable() {
		this.intervalIdEmit = setInterval(() => {
			if (this.isGameRunning === true)
				this.serverSocket.to(this.gameRoomEvent).emit('updateTable', this.table);
		}, this.fpsTargetInMs);
	}


	private resetPositionPlayerAndBall() {
		if (this.gameMod !== PODGAME.EGameMod.trainning) {
			this.table.positionP1v = {
				x: this.paddlePosMargin * this.table.tableSize.x,
				y: this.table.tableSize.y / 2 - this.table.sizeP1.y / 2
			};
		}
		this.table.positionP2v = {
			x: this.table.tableSize.x - (this.paddlePosMargin * this.table.tableSize.x) - this.table.sizeP2.x,
			y: this.table.tableSize.y / 2 - this.table.sizeP2.y / 2
		};
		this.table.positionBall = {
			x: (this.table.tableSize.x / 2) - (this.table.sizeBall.x / 2),
			y: (this.table.tableSize.y / 2) - -(this.table.sizeBall.y / 2),
		};
	}

	private ballEngagement() {
		const angleRandom: number = (Math.random() * 2 - 1);
		let dx: number;

		if (this.lastPlayerScore === this.player1)
			dx = 1;
		else if (this.lastPlayerScore === this.player2)
			dx = -1;
		else {
			if (Math.random() < 0.5)
				dx = 1;
			else
				dx = -1;
		}
		this.ballDirection = {dx: dx, dy: angleRandom};
		this.ballSpeed = this.ballSpeedInitial;
		this.speedPaddle = this.speedPaddleInitial;
		this.hitCounter = 0;
		if (this.gameMod === PODGAME.EGameMod.trainning)
			this.table.trainningHit = 0;
		if (this.gameMod === PODGAME.EGameMod.ghost)
			this.ghostZoneSize = this.ghostZoneSizeInitial;
	}


	private addGoalToPlayer(player: PODGAME.userInfoSocket) {
		this.resetPositionPlayerAndBall();
		if (player === this.player1) {
			this.table.scoreP1++;
			this.lastPlayerScore = this.player1; //determnine le sens de lengagement
		} else {
			this.table.scoreP2++;
			this.lastPlayerScore = this.player2; //determnine le sens de lengagement
		}
		if (!this.isEndGameCheckScoring()) {
			this.ballDirection = {dx: 0, dy: 0};
			setTimeout(() => {
				this.ballEngagement();
			}, 2000)
		}

	}

	//enclencher un compteur 3,2,1,GO envoyé au front avant de declencher le coup d'envoi
	private startCountdownIfPlayersReady() {
		if ((this.isP1Ready && this.isP2Ready) || this.gameMod === PODGAME.EGameMod.trainning) {
			this.isGameReady = true;
			let countdown: number = 3;
			let intervalStart = setInterval(() => {
				if (countdown > 0)
					this.serverSocket.to(this.gameRoomEvent).emit('countdown', countdown.toString());
				else if (countdown === 0)
					this.serverSocket.to(this.gameRoomEvent).emit('countdown', 'GO');
				else if (countdown < 0) {
					this.serverSocket.to(this.gameRoomEvent).emit('countdown', '');
					this.startGame();
					clearInterval(intervalStart);
				}
				countdown--;
			}, 620)
			return;
		} else if (this.isP1Ready || this.isP2Ready) {
			setTimeout(() => {
				if (this.isGameReady === false) {
					this.isP1Ready = true;
					this.isP2Ready = true;
					this.startCountdownIfPlayersReady();
				}
			}, 5000);
			return;
		}
	}

	//message de fin de game et reset de la game
	private messageEndGameAndReset() {
		this.cleanup()
		if (this.gameMod !== PODGAME.EGameMod.classic && this.gameMod !== PODGAME.EGameMod.ghost) {
			this.table.sizeP1 = this.classicPaddleSize;
			this.table.sizeP2 = this.classicPaddleSize;
			this.serverSocket.to(this.gameRoomEvent).emit('updateTable', this.table);
		}
		const endMessage = () => {
			if (this.gameMod === PODGAME.EGameMod.trainning) {
				if (this.table.maxTrainningHit <= 3)
					return `${this.table.maxTrainningHit}: Did you really play?`;
				else if (this.table.maxTrainningHit >= 4 && this.table.maxTrainningHit <= 8)
					return `${this.table.maxTrainningHit}: It's a good start, courage!`;
				else if (this.table.maxTrainningHit > 8 && this.table.maxTrainningHit <= 13)
					return `${this.table.maxTrainningHit}: One more effort!`;
				else if (this.table.maxTrainningHit > 13 && this.table.maxTrainningHit <= 20)
					return `${this.table.maxTrainningHit}: Wow, well done that's great!`;
				else if (this.table.maxTrainningHit > 20 && this.table.maxTrainningHit < 42)
					return `${this.table.maxTrainningHit}: You have become a god, but.. return worked!`;
				else if (this.table.maxTrainningHit >= 42)
					return `${this.table.maxTrainningHit}: It's impossible ! Otherwise: Incredible!`
			} else if (this.rageQuit === true)
				return `${this.looser.user.nickname} has rage quit! ${this.winner.user.nickname} won this game\n${this.table.scoreP1} - ${this.table.scoreP2}`
			else
				return `${this.winner.user.nickname} won this game\n${this.table.scoreP1} - ${this.table.scoreP2}`
		}
		this.serverSocket.to(this.gameRoomEvent).emit('endgame', endMessage());
		setTimeout(() => {
				this.serverSocket.to(this.gameRoomEvent).emit('reset');
				this.player1.socket.leave(this.gameRoomEvent);
				this.player2.socket.leave(this.gameRoomEvent);
			}
			, 2000);
	}

	//Enclenche la fin du jeu
	private endOfGame() {

		if (this.table.scoreP1 > this.table.scoreP2) {
			this.winner = this.player1;
			this.looser = this.player2;
			this.serverSocket
				.to(this.gameRoomEvent)
				.emit('info', `${this.player1.user.nickname} won this game`);
		} else {
			this.winner = this.player2;
			this.looser = this.player1;
			this.serverSocket
				.to(this.gameRoomEvent)
				.emit('info', `${this.player2.user.nickname} won this game`);
		}
		this.isGameRunning = false;
		if (this.gameMod != EGameMod.trainning) {
			this.gameService.create(this.player1.user.UserID, this.player2.user.UserID, this.table.scoreP1, this.table.scoreP2, this.startDate);
			this.gameService.endGameStatus(this.player1.user.UserID, this.player2.user.UserID);
		} else
			this.gameService.endGameStatus(this.player1.user.UserID);
		this.messageEndGameAndReset();
	}

	//Gestion fin du game, si score max atteint => endOfGame
	private isEndGameCheckScoring() {
		if (this.table.scoreP1 >= this.scoreLimit ||
			this.table.scoreP2 >= this.scoreLimit) {
			this.endOfGame();
			return true;
		} else
			return false;
	}

	//clean les intervals pour eviter les fuites memoires
	private cleanup() {
		clearInterval(this.intervalId);
		clearInterval(this.intervalIdEmit);
	}

	///////// METHODS ////////////
	public addSpectator(newSpectatorSocket: PODGAME.userInfoSocket) {
		newSpectatorSocket.socket.join(this.gameRoomEvent);
		this.spectator.push(newSpectatorSocket);
	}

	private startGame() {
		this.ballEngagement();
		this.isGameRunning = true;
		this.positionManagement();
		this.player1.socket.emit('startGame');
		this.player2.socket.emit('startGame');
	}


	private playerSocketMonitoring() {
		if (this.player1.socket.connected === false) {
			this.table.scoreP2 = this.scoreLimit;
			this.rageQuit = true;
			this.isEndGameCheckScoring();
		} else if (this.player2.socket.connected === false) {
			this.table.scoreP1 = this.scoreLimit;
			this.rageQuit = true;
			this.isEndGameCheckScoring();
		}
	}

	///////// ACCESSORS ////////////
	public getGameId(): number {
		return this.game_id;
	}

	public getPlayer1(): PODGAME.userInfoSocket {
		return this.player1;
	}

	public getPlayer2(): PODGAME.userInfoSocket {
		return this.player2;
	}

	public getIsGameRunning(): boolean {
		return this.isGameRunning;
	}

	public setSocketPlayer1(newSocket: Socket) {
		this.player1.socket = newSocket;
	} 

	public setSocketPlayer2(newSocket: Socket) {
		this.player2.socket = newSocket;
	}


}
