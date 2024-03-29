import Profile from "@/components/ProfileComponent";
import Button from "@/components/CustomButtonComponent";
import UserList from "@/components/UserListComponent";
import Game from "@/components/game/Game";
import React, {useContext, useEffect, useRef, useState} from "react";
import {LoggedContext, SocketContextChat, SocketContextGame, UserContext} from "@/context/globalContext";
import {authManager} from "@/components/api/ApiReq";
import {useRouter} from "next/navigation";
import {getUserMe} from "@/app/auth/Auth";
import {NotificationManager} from 'react-notifications';
import NotifComponent from "@/components/notif/NotificationComponent";
import Button2FA from "@/components/2FA/2FAComponent";
import ChatMaster from "./chat/ChatMaster";
import LoadingComponent from "@/components/waiting/LoadingComponent";
import MatchHistory from "@/components/MatchHistoryComponent";
import Leaderboard from "@/components/LeaderboardComponent";
import '@/components/chat/chat.css';
import {INotif} from "@/shared/types";
import { Socket } from "socket.io";


const HomePage = () => {
    const {userContext, setUserContext} = useContext(UserContext);
    const {setLogged} = useContext(LoggedContext);
    const router = useRouter();
    const tokenRef = useRef<string>('');
    const [showMatchHistory, setMatchHistoryVisible] = useState(false);
    const [showLeaderboard, setLeaderboardVisible] = useState(false);
    const socketChat = useContext(SocketContextChat);
    const socketGame = useContext(SocketContextGame);

    const [is2faVisible, setIs2faVisible] = useState<boolean>(false)


    function handleNotif(data: INotif) {
        switch (data.type) {
            case "success":
                NotificationManager.success(data.message, data.title, data.time);
                break;
            case "error":
                NotificationManager.error(data.message, data.title, data.time);
                break;
            case "warning":
                NotificationManager.warning(data.message, data.title, data.time);
                break;
            case "info":
                NotificationManager.info(data.message, data.title, data.time);
                break;
            default:
                console.error("Unknown notif type received: " + JSON.stringify(data));
        }
    }

    function handleListenNotifON() {
        socketChat?.on("notif", (data: INotif) => {
            handleNotif(data);
        })
        socketGame?.on("notif", (data: INotif) => {
            handleNotif(data);
        })
    }
    function handleListenNotifOFF() {
        socketChat?.off("notif", (data: INotif) => {
            handleNotif(data);
        })
        socketGame?.off("notif", (data: INotif) => {
            handleNotif(data);
        })
    }
    
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token)
            router.push("/auth");
        else
            tokenRef.current = token;
        if (!userContext || userContext.UserID == -1)
        {
            let user;
            authManager.setToken(token);
            getUserMe(user).then((me) => setUserContext(me) )
                .catch(() => {
                    localStorage.clear();
                    router.push("/auth");
                });
        }
        localStorage.setItem('userContext', JSON.stringify(userContext));

        handleListenNotifON();
        return(() => {
            window.location.reload();
            handleListenNotifOFF();
            
        })
    }, []);

    
    useEffect(() => {
        if (is2faVisible)
        {
            setMatchHistoryVisible(false)
            setLeaderboardVisible(false);
        }
    
    },[is2faVisible])

    return (
        <>
        { userContext ?
            <main className="main-background">

                    <Profile className={"main-user-profile"}
                             user={userContext}

                             isEditable={true} avatarSize={"big"} showStats={true} isMainProfile={true} >
                        <Button image={"/history-list.svg"} onClick={() => {
                            setMatchHistoryVisible(!showMatchHistory);
                            setLeaderboardVisible(false);
                            setIs2faVisible(false);
                        }} alt={"Match History button"} title={"Match History"}/>
                        <Button image={"/podium.svg"} onClick={() => {
                            setLeaderboardVisible(!showLeaderboard);
                            setIs2faVisible(false);
                            setMatchHistoryVisible(false);
                        }} alt={"Leaderboard button"} title={"Leaderboard"} margin={"0 0 0 2ch"}/>
              
                        <Button2FA hasActive2FA={userContext.has_2fa} setterVisibilty={setIs2faVisible} visibility={is2faVisible}>2FA</Button2FA>
                    </Profile>

                {showMatchHistory && <MatchHistory/>}
                {showLeaderboard &&  <Leaderboard/>}

                <UserList className={"friends"} userListIdProperty={"friends_user_list"} avatarSize={"medium"} showUserProps={true} userID={userContext.UserID}/>
                <Button className={"logout"} image={"/logout.svg"} onClick={() => {
                    localStorage.clear();
                    router.push("/auth");
                    setLogged(false);
                    }
                } alt={"Logout button"}/>

                <div className={"game"}>
                    <Game className={"game"} token={tokenRef.current}/>
                </div>
               <ChatMaster className={'chat_master'} token={tokenRef.current} userID={userContext.UserID}/>
                <div className={"absolute bottom-0 left-0"}><NotifComponent /></div>

            </main>
        : <LoadingComponent/>}
        </>
    )
}

export default HomePage;
