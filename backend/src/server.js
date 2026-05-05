const config = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');
const mongoose = require('mongoose');
const http = require('http');
const { initSocketServer } = require('./services/socket.service');

const startServer = async () => {
  try {
    await connectDB();

    const server = http.createServer(app);
    initSocketServer(server, config.corsOrigins);

    server.listen(config.port, () => {
      // eslint-disable-next-line no-console
      console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });

    const gracefulShutdown = (signal) => {
      // eslint-disable-next-line no-console
      console.log(`${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('unhandledRejection', (reason) => {
      // eslint-disable-next-line no-console
      console.error('Unhandled Rejection:', reason);
      gracefulShutdown('unhandledRejection');
    });
    process.on('uncaughtException', (error) => {
      // eslint-disable-next-line no-console
      console.error('Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();
