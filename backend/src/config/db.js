const mongoose = require('mongoose');
const config = require('./env');

const connectDB = async () => {
  mongoose.set('strictQuery', true);

  await mongoose.connect(config.mongoUri, {
    autoIndex: config.nodeEnv !== 'production',
  });

  // eslint-disable-next-line no-console
  console.log('MongoDB connected successfully.');
};

module.exports = connectDB;
