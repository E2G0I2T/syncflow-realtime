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
    async ({ boardId, cardId, fromCol, toCol, position, token }) => {
      try {
        await axios.patch(
          `${process.env.SPRING_API_URL}/api/cards/${cardId}/move`,
          { columnKey: toCol, position },
          { headers: { Authorization: `Bearer ${token}` } },
        );

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

  // 댓글 추가 이벤트
  socket.on(
    "add_comment",
    async ({ boardId, cardId, content, token }) => {
      try {
        const res = await axios.post(
          `${process.env.SPRING_API_URL}/api/cards/${cardId}/comments`,
          { content },
          { headers: { Authorization: `Bearer ${token}` } },
        );

        // 작성자 포함 같은 보드의 모든 클라이언트에게 브로드캐스트
        io.to(`board_${boardId}`).emit("comment_added", {
          cardId,
          comment: res.data,
        });
      } catch (error) {
        console.error("댓글 추가 실패:", error.message);
        socket.emit("comment_error", {
          cardId,
          message: "댓글 추가에 실패했습니다.",
        });
      }
    },
  );

  // 댓글 수정 이벤트
  socket.on(
    "update_comment",
    async ({ boardId, cardId, commentId, content, token }) => {
      try {
        const res = await axios.put(
          `${process.env.SPRING_API_URL}/api/cards/${cardId}/comments/${commentId}`,
          { content },
          { headers: { Authorization: `Bearer ${token}` } },
        );

        io.to(`board_${boardId}`).emit("comment_updated", {
          cardId,
          comment: res.data,
        });
      } catch (error) {
        console.error("댓글 수정 실패:", error.message);
        socket.emit("comment_error", {
          cardId,
          message: "댓글 수정에 실패했습니다.",
        });
      }
    },
  );

  // 댓글 삭제 이벤트
  socket.on(
    "delete_comment",
    async ({ boardId, cardId, commentId, token }) => {
      try {
        await axios.delete(
          `${process.env.SPRING_API_URL}/api/cards/${cardId}/comments/${commentId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        io.to(`board_${boardId}`).emit("comment_deleted", {
          cardId,
          commentId,
        });
      } catch (error) {
        console.error("댓글 삭제 실패:", error.message);
        socket.emit("comment_error", {
          cardId,
          message: "댓글 삭제에 실패했습니다.",
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