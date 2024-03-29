import { IUser } from '@/shared/types'
import React, { useLayoutEffect, useState } from 'react'
import * as apiReq from '@/components/api/ApiReq'
import Profile from '@/components/ProfileComponent';
import {v4 as uuidv4} from "uuid";
import { IInviteEntity } from '@/shared/entities/IInvite.entity';

export default function AddUserPrivateChannel({ className, channelID}:
	{ 
		className: string,
		currentChannel: number,
		channelID: number
	}) {
  const [userListFollo, setUserListFollo] = useState<IUser[]>([]);
  const [inviteListChannel, setInviteListChannel] = useState<IInviteEntity[]>([]);
  const [userListChan, setUserListChan] = useState<IUser[]>([]);
  const [userList, setUserList] = useState<IUser[]>([]);
  const [popupIsVisible, setPopupIsVisible] = useState<boolean>(false);


	const elementClickable = (user: IUser) => {
		function queryInvite(userID: number){
			apiReq.putApi.inviteUserInChannel(userID, channelID)
			.then(() => {})
			.catch(() => {})
		} 

		return (
			<div key={uuidv4()} className={'flex-col'} onClick={() => queryInvite(user.UserID)} >
				<Profile user={user} avatarSize={"medium"}></Profile>
			</div>
			)
	}

	useLayoutEffect(() =>{
		apiReq.getApi.getAllUsersFromChannel(channelID, new Date)
		.then((res) => {
			setUserList(res.data)
		})
			.catch(() => {});
	
	}, [])

	useLayoutEffect(() => {
		if (popupIsVisible){

			apiReq.getApi.getAllUsersFromChannel(channelID, new Date)
			.then((res) => {
				const lst = res.data
				setUserListChan(lst)
			})
				.catch((reason) => {});
			apiReq.getApi.getAllMyFollowers()
			.then((res) => {
				const tmpLst: IUser[] = res.data.filter((user) => !userList.includes(user))
				setUserListFollo(tmpLst);
			})
				.catch((reason) => {});
			apiReq.getApi.getInviteChannelID(channelID)
			.then((res) => {
					setInviteListChannel(res.data);
			})
				.catch((reason) => {});
		}
	
	}, [popupIsVisible])



  function handleAddUser() {
    return (
			<div className="user_private_list">
				{userListFollo
					.filter((user) => {
						return !userListChan.some((chan) => user.UserID === chan.UserID);
					})
					.filter((user) =>  {
						return !inviteListChannel.some((chan) => user.UserID === chan.user.UserID);
					})
					.map((user) => {
						return elementClickable(user);
					})}
				{userListFollo.filter((user) => {
					return !userListChan.some((chan) => user.UserID === chan.UserID);
				})
					.filter((user) =>  {
						return !inviteListChannel.some((chan) => user.UserID === chan.user.UserID);
					})
					.length === 0 && <div className="text-center">No user to invite</div>}
			</div>
		);
  }

  return (
    <>
      <span
        className={className}
        onClick={(event) => {
          event.stopPropagation();
					if (popupIsVisible === false)
          	setPopupIsVisible(true);
					else
						setPopupIsVisible(false);
        }}
      >
        ➕
      </span>
      {popupIsVisible && (
        <span className='  chat_new_channel_popup_inviteChan translate-y-[-40px] '>
          {handleAddUser()}
        </span>
      )}
    </>
  );
}

