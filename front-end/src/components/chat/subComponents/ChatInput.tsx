'use client'

import { IUser } from '@/shared/types';
import Image from 'next/image';
import React, { useState } from 'react'
import { SocketOptions, Socket } from 'socket.io-client';
import { messageDTO } from '@/shared/DTO/InterfaceDTO';
import { wsChatEvents } from '@/components/api/WsReq';
const max_msg_lenght: number = 140;

export default function ChatInput({className, socket, channelID}: {className: string, socket: Socket, channelID: number})
{
	const [message, setMessage] = useState<string>("");

  const sendMessage = (msg: string) => {
    if (channelID === -1)
      return;
		if (msg.trim().length === 0) return;
		else if (msg.length >= max_msg_lenght) {
			alert(`Votre message doit faire moins de ${max_msg_lenght} caractères ;)`);
			setMessage("");
			return;
		}
		if (socket.connected) {
      const messObj: messageDTO.ISendMessageDTOPipe = {
        content: message,
        channelID: channelID
			};
      wsChatEvents.sendMsg(socket, messObj);
			setMessage("");
		}
	};

   return (
    
    <div className={`${className}`}>
    
    <input
    type="text"
      autoFocus={true}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') 
            sendMessage(message);
          }}
          className="chat_block_messages_input_input"
          />
        <button onClick={() => {sendMessage(message)}} className="chat_block_messages_input_button">
          <Image
            src="/chat/send.svg"
            alt="Send button"
            width={32}
            height={32}
            />
            </button>
            </div>
            
           
    )
}
