const { default: mongoose } = require("mongoose");
require("dotenv").config();

const connectToMongoDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/game";
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to MongoDB successfully!");
  } catch (e) {
    console.error("Error connecting to MongoDB: ", e.message);
    process.exit(1);
  }
};

module.exports = connectToMongoDB;
