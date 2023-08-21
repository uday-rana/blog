import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
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
      await mongoose.connect(process.env.USERS_DATABASE_URL);
      User = mongoose.model("users", userSchema);
    } catch (error) {
      console.error(error);
    }
  },
  registerUser: async (userData) => {
    if (userData.password != userData.password2) {
      throw new Error("Passwords do not match.");
    }
    const user = await User.findOne({ userName: userData.userName });
    if (user) {
      throw new Error(`Username "${userData.userName}" not available.`);
    }
    const hash = await bcrypt.hash(userData.password, 10);
    userData.password = hash;

    const newUser = new User(userData);
    await newUser.save();
  },
  checkUser: async (userData) => {
    const user = await User.findOne({ userName: userData.userName });
    if (!user) {
      throw new Error(`Unable to find user "${userData.userName}".`);
    }
    const passwordsMatch = await bcrypt.compare(
      userData.password,
      user.password,
    );
    if (!passwordsMatch) {
      throw new Error(`Incorrect password for user "${userData.userName}".`);
    }
    user.loginHistory.push({
      dateTime: new Date().toString(),
      userAgent: userData.userAgent,
    });
    await User.updateOne(
      { userName: user.userName },
      { $set: { loginHistory: user.loginHistory } },
    );
    return user;
  },
  getUser: async (userData) => {
    const user = await User.findOne({ userName: userData.userName }).lean();
    if (!user) {
      throw new Error(`Unable to find user "${userData.userName}".`);
    }
    return user;
  },
};

export default authService;
