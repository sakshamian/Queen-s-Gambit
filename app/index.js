"use strict";

require("dotenv").config();

const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Chess } = require("chess.js");
const { Server } = require("socket.io");
const io = new Server(server);
const PORT = 8080;
const path = require("path");

const dir = {
  public: path.join(__dirname, "../", "public"),
};
// html views
const views = {
  bot: path.join(__dirname, "../", "public/views/bot.html"),
  online: path.join(__dirname, "../", "public/views/online.html"),
  landing: path.join(__dirname, "../", "public/views/index.html"),
};

// making public folder available, contains html, scripts, css, images
app.use(express.static(dir.public));

const files = {
  chessboardjs: path.join(__dirname, "../", "node_modules/@chrisoakman/chessboardjs/dist"),
  chessjs: path.join(__dirname, "../", "node_modules/chess.js"),
}

// making chessboardjs files available
app.use(
  express.static(files.chessboardjs)
);
// making chess.js files available
app.use(express.static(files.chessjs));

// answering / get requests with index.html
app.get("/", (_req, res) => {
  res.sendFile(views.landing);
});

// keeping track of all the rooms
const rooms = [];

// if a client is trying to join a room that exists,
// the client will get che chess-page.html otherwise it will get be redirected to /
app.get("/play/online", (req, res) => {
  if (rooms.find((room) => room.name === req.query.roomName)) {
    res.sendFile(views.online);
  } else {
    res.redirect("/");
  }
});

app.get("/play/bot", (req, res) => {
  res.sendFile(views.bot);
});

app.get("/play", (req, res) => {
  res.redirect("/");
});

app.get("*", (req, res) => {
  res.send("404");
});

io.on("connection", (socket) => {
  socket.emit("room_list", rooms);

  let roomNameSocket = "";
  let userNameSocket = "";
  socket.on("create_room", (type, name, algorithmName, depth, time) => {
    if (rooms.find((room) => room.name === name)) {
      console.log("Room already exists:", name);
      return;
    }
    console.log("Creating room:", name);
    rooms.push({
      name,
      white: {},
      black: {},
      spectators: [],
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      restart: "",
      switch: "",
    });
  });

  // handling join_room event
  socket.on("join_room", (name, userName) => {
    console.log(userName, "is joining room", name);

    // find room the user want to join
    const room = rooms.find((r) => r.name === name);
    if (room) {
      // if room exists, socket joins room
      socket.join(name);
      if (Object.keys(room.white).length === 0) {
        // if room.white is empty, user is white
        room.white.id = socket.id;
        room.white.name = userName;
        socket.emit("side", "w");
      } else if (Object.keys(room.black).length === 0) {
        // if room.black is empty, user is black
        room.black.id = socket.id;
        room.black.name = userName;
        socket.emit("side", "b");
      } else {
        // if room is full, user is spectator
        room.spectators.push({ name: userName, id: socket.id });
        socket.emit("side", "s");
      }
      roomNameSocket = room.name;
      userNameSocket = userName;
    }
    io.to(room.name).emit("room_status", room);
    io.emit("room_list", rooms);
  });

  socket.on("move", (san) => {
    const room = rooms.find((r) => r.name === roomNameSocket);

    if (room) {
      const game = new Chess(room.fen);
      const move = game.move(san);
      room.fen = game.fen();

      io.to(room.name).emit("update_board", room.fen, move.san);
      io.to(room.name).emit("move", move);
    }
  });

  socket.on("restart_request", () => {
    const room = rooms.find((r) => r.name === roomNameSocket);
    switch (socket.id) {
      case room.white.id:
        room.restart = "w";
        io.to(room.black.id).emit("restart_requested");
        console.log("restart requested by white");
        break;
      case room.black.id:
        room.restart = "b";
        io.to(room.white.id).emit("restart_requested");
        console.log("restart requested by black");
        break;
      default:
        console.log("unknown user requested restart");
        break;
    }
    io.to(room.name).emit("room_status", room);
  });

  socket.on("restart_grant", () => {
    const room = rooms.find((r) => r.name === roomNameSocket);
    console.log("restart_grant");
    if (
      (room.restart === "w" && socket.id === room.black.id) ||
      (room.restart === "b" && socket.id === room.white.id)
    ) {
      console.log("restart granted");
      room.fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
      room.restart = "";
      io.to(room.name).emit("room_status", room);
      io.to(room.name).emit("update_board", room.fen, null);
    }
  });

  socket.on("switch_request", () => {
    console.log("switch request");
    const room = rooms.find((r) => r.name === roomNameSocket);

    switch (socket.id) {
      case room.white.id:
        room.switch = "w";
        io.to(room.black.id).emit("switch_requested");
        console.log("switch requested by white");
        break;
      case room.black.id:
        room.switch = "b";
        io.to(room.white.id).emit("switch_requested");
        console.log("switch requested by black");
        break;
      default:
        console.log("unknown user requested switch");
        break;
    }
    io.to(room.name).emit("room_status", room);
  });

  socket.on("switch_grant", () => {
    const room = rooms.find((r) => r.name === roomNameSocket);
    if (
      (room.switch === "w" && socket.id === room.black.id) ||
      (room.switch === "b" && socket.id === room.white.id)
    ) {
      console.log("switching sides");
      room.fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
      const { white } = room;
      room.white = room.black;
      room.black = white;
      room.switch = "";
      room.restart = "";
      io.to(room.white.id).emit("side", "w");
      io.to(room.black.id).emit("side", "b");
      io.to(room.name).emit("room_status", room);
      io.to(room.name).emit("update_board", room.fen);
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
    if (roomNameSocket) {
      const room = rooms.find((r) => r.name === roomNameSocket);
      if (room.white.id === socket.id) {
        console.log(
          userNameSocket,
          "Quite as white player from the room",
          roomNameSocket
        );
        room.white = {};
      } else if (room.black.id === socket.id) {
        console.log(
          userNameSocket,
          "Quit as black player from the room",
          roomNameSocket
        );
        room.black = {};
      } else {
        console.log(
          userNameSocket,
          "Quit as spectator player from the room",
          roomNameSocket
        );
        room.spectators = room.spectators.filter(
          (spectator) => spectator.id !== socket.id
        );
      }
      io.to(room.name).emit("room_status", room);
      if (
        Object.keys(room.white).length === 0 &&
        Object.keys(room.black).length === 0 &&
        room.spectators.length === 0
      ) {
        console.log("Room removed:", roomNameSocket);
        rooms.splice(rooms.indexOf(room), 1);
        io.emit("room_list", rooms);
      }
    }
  });
});

// start server
server.listen(PORT, () => {
  console.log(`Live server started on port:${server.address().port}`);
});