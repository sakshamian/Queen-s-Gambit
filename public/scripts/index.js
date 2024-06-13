"use strict";

const roomNameInput = document.getElementById("roomName");

const socket = io();

function createRoom(type) {
  console.log(type);
  if (
    document.getElementById("userName").checkValidity() &&
    document.getElementById("roomName").checkValidity()
  ) {
    switch (type) {
      case "single":
        if (
          document.getElementById("Depth").checkValidity() &&
          document.getElementById("Time").checkValidity()
        ) {
          console.log("Creating room: ", roomNameInput.value);
          const depth = Number(document.getElementById("Depth").value);
          const time = Number(document.getElementById("Time").value);
          socket.emit("create_room", type, roomNameInput.value, depth, time);
        }
        break;
      case "multi":
        socket.emit("create_room", type, roomNameInput.value);
        break;
      default:
        console.log("error: trying to create room with unknown type");
        break;
    }
  }
}

// the user needs a name to join a room
function joinRoom(roomName) {
  console.log("joining room: ", roomName);
  if (document.getElementById("userName").checkValidity()) {
    // console.log("moving to chess-page.html with roomName: ", roomName);

    // setting room name to pass it with form to chess-page.html
    roomNameInput.value = roomName;
    // submit form
    document.getElementById("formMulti").submit();
  } else {
    document.getElementById("userName").focus();
  }
}

socket.on("room_list", (roomListServer) => {
  document.getElementById("rows").textContent = "";

  for (let i = 0; i < roomListServer.length; i += 1) {
    const room = roomListServer[i];
    const roomRow = document.createElement("tr");
    const roomName = document.createElement("td");
    roomName.innerText = room.name;
    const roomWhite = document.createElement("td");
    roomWhite.innerText = room.white.name ? room.white.name : "";
    const roomBlack = document.createElement("td");
    roomBlack.innerText = room.black.name ? room.black.name : "";
    const roomSpecators = document.createElement("td");
    roomSpecators.innerText = room.spectators.length;
    
    const roomButton = document.createElement("td");
    const roomJoinButton = document.createElement("button");
    roomJoinButton.textContent = "Spectate";
    roomJoinButton.addEventListener("click", () => {
      joinRoom(room.name);
    });

    roomButton.appendChild(roomJoinButton);

    roomRow.appendChild(roomName);
    roomRow.appendChild(roomWhite);
    roomRow.appendChild(roomBlack);
    roomRow.appendChild(roomSpecators);
    roomRow.appendChild(roomButton);

    document.getElementById("rows").appendChild(roomRow);
  }
});
