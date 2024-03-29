// +---------------------------------------------------------------------+
// |                         CHANNEL INTERFACE                           |
// +---------------------------------------------------------------------+

import { Socket } from "socket.io";
import { IUser } from "./types";

export enum EChannelType {
	PUBLIC, //No password No Privacy
	PROTECTED, //Yes Password No Privacy
	PRIVATE, //Maybe password Yes Privacy
	DIRECT,
}

// export interface IChannel {
//   channelID: number;
//   name: string;
//   type: number;
//   ownerUserID: number;
//   ownerLogin?: string;
// }

export interface IChannel {
  channelID: number;
  owner: IUser;
  name: string;
  type: EChannelType;
  password?: string;
  // adminList: User[];
  // userList: User[];
  // messages: Message[];
  // inviteList: Invite[];
  // muteList: Mute[];
  // bannedList: Banned[];
}

export interface IChannelMessage {
	id: number;
	author: IUser;
	sendTime: Date;
	channel: IChannel;
	content: string;
}

// //DTO recup

// export interface ICreateChannelDTOPipe {
// 	name: string;
// 	privacy: boolean;
// 	password?: string;
// }

