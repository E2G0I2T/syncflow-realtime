require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const axios = require("axios");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// 헬스체크
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// boardId별 접속자 관리
// rooms: { boardId: Set<socketId> }

io.on("connection", (socket) => {
  console.log(`클라이언트 접속: ${socket.id}`);

  // 보드 입장
  socket.on("join_board", ({ boardId }) => {
    socket.join(`board_${boardId}`);
    console.log(`${socket.id} → board_${boardId} 입장`);
  });

  // 보드 퇴장
  socket.on("leave_board", ({ boardId }) => {
    socket.leave(`board_${boardId}`);
    console.log(`${socket.id} → board_${boardId} 퇴장`);
  });

  // 카드 이동 이벤트
  socket.on(
    "move_card",
    async ({ boardId, cardId, fromCol, toCol, position, token, socketId }) => {
      try {
        await axios.patch(
          `${process.env.SPRING_API_URL}/api/cards/${cardId}/move`,
          { columnKey: toCol, position },
          { headers: { Authorization: `Bearer ${token}` } },
        );

        // socketId 포함해서 브로드캐스트
        socket.to(`board_${boardId}`).emit("card_moved", {
          cardId,
          fromCol,
          toCol,
          position,
        });

        socket.emit("move_card_success", { cardId });
      } catch (error) {
        console.error("카드 이동 실패:", error.message);
        socket.emit("move_card_error", {
          cardId,
          message: "카드 이동에 실패했습니다.",
        });
      }
    },
  );

  // 연결 해제
  socket.on("disconnect", () => {
    console.log(`클라이언트 해제: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`실시간 서버 실행 중: http://localhost:${PORT}`);
});
