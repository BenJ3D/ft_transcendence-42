import React, {useContext, useEffect, useRef, useState} from "react";
import {EStatus, IMatch, IRelationships, IUser} from "@/shared/types";
import {getApi} from "@/components/api/ApiReq";
import {v4 as uuidv4} from "uuid";
import {SelectedUserContext, SocketContextChat} from "@/context/globalContext";
import UserOptions from "@/components/UserOptions";

const MatchHistory : React.FC = () => {
    const [matchesList, setMatchesList] = useState<IMatch[]>([]);
    const {selectedUserContext, setSelectedUserContext} = useContext(SelectedUserContext);
    const [selectedUserRelationships, setSelectedUserRelationships] = useState<IRelationships>({followed:[], blocked:[]});
    const [refresh, setRefresh] = useState(false);
    let matchElements : React.JSX.Element[] = [];
    const socketChat      = useContext(SocketContextChat);
    const socketChatRef   = useRef(socketChat);

    useEffect(() => {
        if (selectedUserContext)
        {
            if (matchesList)
                getApi.getMatchHistoryFromUserId(selectedUserContext.UserID)
                    .then((res) => {
                        setMatchesList(res.data);
                    });
            getApi.getMyRelationships()
                .then((res) => {
                    setSelectedUserRelationships({followed:res.data.subscribed, blocked:res.data?.blocked});
                });
            return () => {};
        }
    }, [selectedUserContext, refresh])

    socketChatRef.current?.on("userUpdate", (data: IUser) => {
        if (selectedUserContext && data.UserID == selectedUserContext.UserID && selectedUserContext.status == EStatus.Online)
            setSelectedUserContext(data);
    });

    socketChatRef.current?.off("userUpdate", (data: IUser) => {
        if (selectedUserContext && data.UserID == selectedUserContext.UserID && selectedUserContext.status == EStatus.Online)
            setSelectedUserContext(data);
    });


    if (matchesList.length > 0 && matchesList.at(0).ID >= 0){
        for (const match of matchesList) {
            const p1Color = match.player1.UserID == selectedUserContext.UserID ? "gold" : "white";
            const p2Color = p1Color == "white" ? "gold" : "white";

            matchElements.push(
                <li key={match.ID + "List" + uuidv4()}>
                    <div id={"match"}>
                        <span id={"winner"} style={{color:p1Color, cursor:"pointer"}} onClick={() => setSelectedUserContext(match.player1)}>
                            {match.player1.nickname}
                        </span>
                        <span id={"looser"} style={{color:p2Color, cursor:"pointer"}} onClick={() => setSelectedUserContext(match.player2)}>
                            {match.player2.nickname}
                        </span>
                        <br/>
                        <span id={"scorep1"}>{match.score1}</span>  <span id={"scorep2"}>{match.score2}</span>
                    </div>
                </li>
            )
        }
    }
    else {
        matchElements.push(
            <div key={"NoMatch" + uuidv4()}>No match played yet</div>
        )
    }

    return (
        <div className={"matchHistory"}>
            <h1>MATCHES HISTORY</h1>
            {selectedUserContext ?
                <ul>
                    {selectedUserContext.nickname}
                        <span style={{position: "absolute", right: "0"}}>({selectedUserContext.login})</span>
                    <UserOptions user={selectedUserContext} relationships={selectedUserRelationships} setRefresh={setRefresh}/>
                    <div>{matchElements}</div>
                </ul>
                : "No user selected"
        }
        </div>
    );
}

export default MatchHistory;