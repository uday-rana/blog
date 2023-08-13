import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    userName: {
      type: String,
      unique: true,
    },
    password: String,
    email: String,
    loginHistory: [
      {
        dateTime: Date,
        userAgent: String,
      },
    ],
  },
  { collection: `users` },
);

let User;

const authService = {
  initialize: async () => {
    try {
      const db = await mongoose.createConnection(process.env.MONGODB_LINK);
      User = db.model("users", userSchema);
    } catch (error) {
      console.error(error);
    }
  },
  registerUser: async (userData) => {
    try {
      if (userData.password != userData.password2) {
        throw new Error("Passwords do not match");
      }

      const hash = await bcrypt.hash(userData.password, 10);
      userData.password = hash;

      const newUser = new User(userData);
      await newUser.save();
    } catch (error) {
      console.error(error);
    }
  },
  checkUser: async (userData) => {
    try {
      console.log(userData);
      const users = await User.find({ userName: userData.userName });
      if (!users.length) {
        throw new Error(`Unable to find user ${userData.userName}`);
      }
      const passwordsMatch = await bcrypt.compare(
        userData.password,
        users[0].password,
      );
      if (!passwordsMatch) {
        throw new Error(`Incorrect password for user: ${userData.userName}`);
      }
      users[0].loginHistory.push({
        dateTime: new Date().toString(),
        userAgent: userData.userAgent,
      });
      await User.updateOne(
        { userName: users[0].userName },
        { $set: { loginHistory: users[0].loginHistory } },
      );
      return users[0];
    } catch (error) {
      console.error(error);
    }
  },
};

export default authService;
