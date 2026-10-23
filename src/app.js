import express from 'express';
import { Server } from 'socket.io';
import { connectDB, initExpress } from './loaders/index.js';
import { config } from './config/index.js';

async function startServer() {
  try {
    await connectDB();

    const app = express();
    initExpress({ app });

    const server = app
      .listen(config.port, () => {
        console.log(`
      ################################################
      🛡️  Server listening on port: ${config.port} 🛡️
      ################################################
    `);
      })
      .on('error', (err) => {
        console.error(err);
        process.exit(1);
      });

    const io = new Server(server, {
      pingTimeout: 60000,
      cors: {
        origin: config.clientOriginUrl || '*',
        methods: ['GET', 'POST'],
      },
    });

    io.on('connection', (socket) => {
      console.log('connection established');

      socket.on('member-loggedIn', ({ member } = {}) => {
        if (member) {
          socket.join(member);
        }
      });

      socket.on(
        'board_task_status_change',
        ({ member, updatedTask, memberIds } = {}) => {
          if (!Array.isArray(memberIds)) return;
          memberIds.forEach((memb) => {
            if (memb === member) return;
            socket.in(memb).emit('board_update', { updatedTask });
          });
        }
      );

      socket.on('delete_task_update', ({ member, taskId, memberIds } = {}) => {
        if (!Array.isArray(memberIds)) return;
        memberIds.forEach((memb) => {
          if (memb === member) return;
          socket.in(memb).emit('delete_update', { taskId });
        });
      });

      socket.on('create_task_update', ({ member, newTask, memberIds } = {}) => {
        if (!Array.isArray(memberIds)) return;
        memberIds.forEach((memb) => {
          if (memb === member) return;
          socket.in(memb).emit('create_update', { newTask });
        });
      });

      socket.on('disconnect', () => {
        console.log('End......');
      });
    });

    io.on('connect_error', (err) => {
      console.log(`connect_error due to ${err.message}`);
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

startServer();
