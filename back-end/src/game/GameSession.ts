import * as PODGAME from 'shared/typesGame';
import * as POD from 'shared/types';
import { Socket } from 'socket.io';
import { Matchmaking } from './Matchmaking';
import { Server } from 'socket.io'
import { Injectable, Inject } from '@nestjs/common';
import { WebsocketGatewayGame } from '../websocket/wsGame.gateway';
import { IUser } from 'shared/types';
// import { Ball } from './Ball'

interface KeyPlayerState{
	isArrowDownPressed      :boolean;
	isArrowUpPressed        :boolean;
}

export class GameSession {
	private game_id: number;
	private gameRoomEvent: string;
  private initElements: PODGAME.ISizeGameElements;
  private infoGameSession: PODGAME.IGameSessionInfo;
	private startDate: Date;
	private speedPaddle: number = 5; // in pixel per move
	private fpsTargetInMs: number = 1000 / 60; // = 16.67ms = 60 fps
  
  ///////////////////////  DEFINE FOR SIZE ELEMENTS ///////////////////////
  private paddlePosMargin : number = 0.01; // 1% of the table
  private ballSizeCoef    : number = 0.03; // en pourcentage par rapport a la largeur de la table
    
	private serverSocket    : Server;
	private player1         : PODGAME.userInfoSocket;
	private player2         : PODGAME.userInfoSocket;
	private spectator       : PODGAME.userInfoSocket[];


  private scoreLimit      : number = 3;

  private winner          : PODGAME.userInfoSocket;
  private looser          : PODGAME.userInfoSocket;

	private isGameRunning   : boolean = true;
  private isP1Ready       : boolean = false;
  private isP2Ready       : boolean = false;

  private ballToRightDBG  : boolean = true;

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

  
	private table: Partial<PODGAME.IPodTable> = {
    positionBall: { x: 0, y: 0 },
    sizeBall:     { x: 14, y: 14 },
		// positionP1: 0,
		// positionP2: 0,
		maxPosP1: 600 - 60,
		maxPosP2: 600 - 60,
		sizeP1: { y: 60, x: 10 },
		sizeP2: { y: 60, x: 10 },
		tableSize: { x: 700, y: 600 }, //taille table server
		scoreP1: 0,
		scoreP2: 0,
	};


	constructor(
		server: Server,
		P1: PODGAME.userInfoSocket,
		P2: PODGAME.userInfoSocket,
		startDate: Date,
		game_id: number,
    gameSessionRoom : string,
	) {
		this.player1 = P1;
		this.player2 = P2;
		this.startDate = startDate;
		this.gameRoomEvent = gameSessionRoom;
		this.serverSocket = server;
		this.table.positionBall = {
			x: this.table.tableSize.x / 2,
			y: this.table.tableSize.y / 2,
		};

    //position de depart -- centrer en y
    this.table.positionP1v = {  x: this.paddlePosMargin * this.table.tableSize.x, 
                                y: this.table.tableSize.y / 2 - this.table.sizeP1.y / 2};
    this.table.positionP2v = {  x: this.table.tableSize.x - (this.paddlePosMargin * (this.table.tableSize.x * 2)), 
                                y: this.table.tableSize.y / 2 - this.table.sizeP2.y / 2};

    this.table.maxPosP1 = this.table.tableSize.y - this.table.sizeP1.y;
    this.table.maxPosP2 = this.table.tableSize.y - this.table.sizeP2.y;
		//////////SET GAME OBJ FOR DATABASE //////////////
		// this.historyGame.start_date = startDate;
		//TODO update GAME TYPE / creer dans la db et recuperer id de session
		//TODO this.historyGame.Id_GAME = requetes API axios ? websocket ?
		////////////////////////////////////////////////////
    
    
    
		//////////SETUP DE LA TABLE //////////////
        this.initElements   = {
          tableServerSize: this.table.tableSize,
          ballSize: this.table.sizeBall,
          paddleP1Pos: this.table.positionP1v,
          paddleP2Pos: this.table.positionP2v,
          paddleP1Size: this.table.sizeP1,
          paddleP2Size: this.table.sizeP2,    
        }
    
        this.infoGameSession  = {
          game_id: game_id,
          gameName: this.gameRoomEvent,
          player1: P1.user,
          player2: P2.user,
          launchTime: startDate,
          startInitElement: this.initElements,
        }
    
		//////////SETUP DES PLAYERS //////////////
    
		//j'inscrit les player a l'event de cette session
		P1.socket.join(this.gameRoomEvent);
		P2.socket.join(this.gameRoomEvent);

		//j'envoi un nom d'event custom a chaque player sur lequel il vont emettre pour informer qu'il bouge
		P1.socket.emit('gameFind', { remoteEvent: `${this.gameRoomEvent}PLAYER1` });
		P2.socket.emit('gameFind', { remoteEvent: `${this.gameRoomEvent}PLAYER2` });

    //les joueurs doivent cliquer sur ready pour commencer le game
    P1.socket.on(`${this.gameRoomEvent}ready`, () => {this.isP1Ready = true; this.startCountdownIfPlayersReady(); 
                                                        console.log(`${this.gameRoomEvent}: player 1 READY`);})
    P2.socket.on(`${this.gameRoomEvent}ready`, () => {this.isP2Ready = true; this.startCountdownIfPlayersReady(); 
                                                        console.log(`${this.gameRoomEvent}: player 2 READY`);})

		//j'ecoute leur propre event pour faire bouger leur paddle respectif
		P1.socket.on(`${this.gameRoomEvent}PLAYER1`, (data) => {
			if (data === PODGAME.EKeyEvent.arrowDownPressed) {
				// == touche BAS enfoncé
				this.keyP1.isArrowDownPressed = true;
				console.log('P1 isArrowDownPressed');
			} else if (data === PODGAME.EKeyEvent.arrowDownRelease) {
				// == touche BAS relaché
				this.keyP1.isArrowDownPressed = false;
				console.log('P1 isArrowDownRelease');
			} else if (data === PODGAME.EKeyEvent.arrowUpPressed) {
				// == touche HAUT enfoncé
				this.keyP1.isArrowUpPressed = true;
				console.log('P1 isArrowUpPressed');
			} else if (data === PODGAME.EKeyEvent.arrowUpRelease) {
				// == touche HAUT relaché
				this.keyP1.isArrowUpPressed = false;
				console.log('P1 isArrowUpRelease');
			}
		});
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
			this.addGoalP1();
			console.log(`P1 GOALLLL`);
			console.log(`SCORE: ${this.table.scoreP1} | ${this.table.scoreP2}`);
		});
		P2.socket.on(`${this.gameRoomEvent}GOAL`, () => {
			this.addGoalP2();
			console.log(`P2 GOALLLL`);
			console.log(`SCORE: ${this.table.scoreP1} | ${this.table.scoreP2}`);
		});


		P1.socket.on(`${this.gameRoomEvent}STOP`, () => {
			console.log(`Player 1 has given up`);
			this.table.scoreP2 = this.scoreLimit ; 
      this.checkScore();//faire gagner le joueur adverse
		});
		P2.socket.on(`${this.gameRoomEvent}STOP`, () => {
			console.log(`Player 2 has given up`); 
			this.table.scoreP1 = this.scoreLimit; 
      this.checkScore();//faire gagner le joueur adverse
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
      console.log(`INFO GAME SESSION START INIT : ${JSON.stringify(this.infoGameSession.startInitElement)}`)
		this.sendUpdateTable(); //lancer setInterval table
	}

  private moveBallLeftRigthDebug = () => {
    //debug value
    if (this.isGameRunning){

      if (this.ballToRightDBG && this.table.positionBall.x + (this.table.sizeBall.x/2) >= 0)
      {  
        if (this.table.positionBall.x + (this.table.sizeBall.x/2) > this.table.tableSize.x)
          this.ballToRightDBG = false;
        else
          this.table.positionBall.x += 7;
      }
      else
      {
        if (this.table.positionBall.x - (this.table.sizeBall.x/2) < 0)
          this.ballToRightDBG = true;
        else
          this.table.positionBall.x -= 7;
      }
    }
    // console.log(`BALL posx: ${this.table.positionBall.x}`)
  }

  //calcul position des paddles en temp reel
	private positionManagement() { 
		if (this.isGameRunning) {
			this.intervalId = setInterval(() => {
				if (this.keyP1.isArrowUpPressed) {
					if (this.table.positionP1v.y > 0)
						this.table.positionP1v.y -= this.speedPaddle;
					// console.log('P1 position ' + this.table.positionP1v.y); //FIXME:
				}
				if (this.keyP1.isArrowDownPressed) {
					if (this.table.positionP1v.y < this.table.maxPosP1)
						this.table.positionP1v.y += this.speedPaddle;
					// console.log('P1 position ' + this.table.positionP1v.y);//FIXME:
				}
				if (this.keyP2.isArrowUpPressed) {
					if (this.table.positionP2v.y > 0)
						this.table.positionP2v.y -= this.speedPaddle;
					// console.log('P2 position ' + this.table.positionP2v.y);//FIXME:
				}
				if (this.keyP2.isArrowDownPressed) {
					if (this.table.positionP2v.y < this.table.maxPosP1)
						this.table.positionP2v.y += this.speedPaddle;
					// console.log('P2 position ' + this.table.positionP2v.y);//FIXME:
				}
        this.moveBallLeftRigthDebug();//juste for anime ball before real bounds physics
			}, this.fpsTargetInMs / 2);
		}
	}

  //envoi update au front des elements de la table
	private sendUpdateTable() {
		this.intervalIdEmit = setInterval(() => {
      //TODO: traduire les valeur de table en % pour le front
      const tableToSend: Partial<PODGAME.IPodTable> = {
        positionP1v : { y: this.table.positionP1v.y / this.table.tableSize.y, x: this.initElements.paddleP1Pos.x },
        positionP2v : {y: this.table.positionP2v.y / this.table.tableSize.y, x: this.initElements.paddleP2Pos.x },
        positionBall: {y: this.table.positionBall.y / this.table.tableSize.y, x: this.table.positionBall.x / this.table.tableSize.x },
        scoreP1: this.table.scoreP1,
        scoreP2: this.table.scoreP2,
      }
			this.serverSocket.to(this.gameRoomEvent).emit('updateTable', this.table);
		}, this.fpsTargetInMs);
	}

  //..
	private addGoalP1() {
		this.table.scoreP1++;
		this.checkScore();
	}
  //.. non vraiment je vais quand meme pas comment ca?!
	private addGoalP2() {
		this.table.scoreP2++;
		this.checkScore();
	}

  //enclencher un compteur 3,2,1,GO envoyé au front avant de declencher le coup d'envoi
  private startCountdownIfPlayersReady(){
    if (this.isP1Ready && this.isP2Ready)
    {
      let countdown : number = 3;
      let intervalStart: NodeJS.Timeout = setInterval(() => {
          if (countdown  > 0)
            this.serverSocket.to(this.gameRoomEvent).emit('countdown', countdown.toString());
          else if (countdown === 0)
            this.serverSocket.to(this.gameRoomEvent).emit('countdown', 'GO');
          else if (countdown < 0) {
            this.serverSocket.to(this.gameRoomEvent).emit('countdown', '');
            this.startGame();
            clearInterval(intervalStart);
          }
          countdown--;
      }, 1000)

    }
  }

  //message de fin de game et reset de la game
  private messageEndGameAndReset(){
    this.cleanup()
    this.serverSocket.to(this.gameRoomEvent).emit('endgame', 
                `${this.winner.user.nickname} won this game\n${this.table.scoreP1} - ${this.table.scoreP2}`);
    setTimeout(() => {
      console.log('reset');
      this.serverSocket.to(this.gameRoomEvent).emit('reset'); 
      this.player1.socket.leave(this.gameRoomEvent);
      this.player2.socket.leave(this.gameRoomEvent);
    }
    , 3500);
  }

  //Enclenche la fin du jeu
	private endOfGame() {
		if (this.table.scoreP1 > this.table.scoreP2) {
      this.winner = this.player1;
      this.looser = this.player2;
			this.serverSocket
      .to(this.gameRoomEvent)
      .emit('info', `${this.player1.user.nickname} won this game`);
			console.log(`${this.player1.user.nickname} won this game`);
		} else {
      this.winner = this.player2;
      this.looser = this.player1;
      this.serverSocket
				.to(this.gameRoomEvent)
				.emit('info', `${this.player2.user.nickname} won this game`);
			console.log(`${this.player2.user.nickname} won this game`);
		}
    // this.serverSocket
    //   .to(this.gameRoomEvent)
    //   .emit('ENDGAME');
    this.messageEndGameAndReset();
    // this.player1.socket.leave(this.gameRoomEvent);
    // this.player2.socket.leave(this.gameRoomEvent);
		// this.cleanup(); //clear interval
	}

  //Gestion fin du game, si score max atteint => endOfGame
	private checkScore() {
		if (
			this.table.scoreP1 >= this.scoreLimit ||
			this.table.scoreP2 >= this.scoreLimit
		)

			this.endOfGame();
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
      console.log(`${this.gameRoomEvent}: le jeu commence`);
		  this.isGameRunning = true;
		  this.positionManagement();
      this.player1.socket.emit('startGame');
      this.player2.socket.emit('startGame');
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
	} //pour gerer une deco/reconnection avec son new socket?

	public setSocketPlayer2(newSocket: Socket) {
    this.player2.socket = newSocket;
	}
  
  

}