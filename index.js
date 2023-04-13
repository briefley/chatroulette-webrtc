// Initial imports, express, filesystem, handlebars and http (Will need HTTPS with SSL certificates set for non-local setup)
const express = require("express");
const app = express();
const fs = require('fs');
const handlebars = require("express-handlebars");
const http = require("http").Server(app);

var server = http;

// Initiate socket.io
const io = require("socket.io")(server, {
  cors: {
    origin: '*'
  }
});

// Outstanding way of holding users information 
const users = {};

// Config and set handlebars to express
const customHandlebars = handlebars.create({ layoutsDir: "./views" });

app.engine("handlebars", customHandlebars.engine);
app.set("view engine", "handlebars");

app.use("/files", express.static("public"));

app.get("/", (req, res) => {
  res.render("index");
});

io.on("connection", function (socket) {
  const socketId = socket.id;
  users[socket.id] = {};

  io.emit('userCount', Object.keys(users).length);

  console.log("connect");
  socket.on("makeAnswer", (answer) => {
    socket.to(users[socketId].pair).emit('answerMade', answer);
  });

  socket.on('call', (reqData) => {
    /*
      * Logic to match free users with each other.
    */
    users[socketId] = reqData.userData;
    if (users[socketId] && users[socketId].searching && !users[socketId].pair) {
      const userKeys = Object.keys(users);
      shuffle(userKeys);
      for (userKey of userKeys) {
        if (userKey !== socketId && users[userKey].searching && !users[userKey].pair) {
          users[socketId].pair = userKey;
          users[userKey].pair = socketId;
          break;
        }
      }
    }
    let currUserObj = users[socketId];
    // Emit the call offer to user
    socket.to(currUserObj.pair).emit('offer', { offer: reqData.offer, currUserObj: currUserObj });
  });

  socket.on('closeConnection', () => {
    let pair = users[socketId].pair;
    socket.to(users[socketId].pair).emit('connectionClosed');
    if (users[pair]) {
      users[pair].pair = null;
    }
    users[socketId] = {
      searching: false,
      pair: null
    };
  });

  socket.on('sendIceCandidate', (candidate) => {
    if (users[socketId].pair) {
      socket.to(users[socketId].pair).emit('receiveIceCandidate', candidate);
    }
  });


  socket.on("disconnect", function () {
    if (users[socketId] && users[socketId].pair) {
      if (users[users[socketId].pair]) {
        users[users[socketId].pair].pair = null;
      }
      socket.to(users[socketId].pair).emit('connectionClosed');
    }
    delete users[socketId];
    io.emit('userCount', Object.keys(users).length);
  });

  function shuffle(array) {
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {

      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }

    return array;
  }

});

server.listen(3000, () => {
  console.log("the app is run in port 3000!");
});