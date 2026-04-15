import mongoose from "mongoose";

const gameSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    gameCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },

    image: {
      type: String,
      required: true
    },

    category: {
      type: String,
      default: "general" // e.g. crash, casino, card
    },

    provider: {
      type: String,
      default: "gamezop"
    },

    isActive: {
      type: Boolean,
      default: true
    },

    order: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

const Game = mongoose.model("Game", gameSchema);

export default Game;