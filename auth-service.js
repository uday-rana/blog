const bcrypt = require(`bcryptjs`);
const mongoose = require(`mongoose`);
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
	{ collection: `users` }
);

let User;

module.exports = {
	initialize: () => {
		return new Promise((resolve, reject) => {
			let db = mongoose.createConnection(process.env.MONGODB_LINK);
			db.on("error", (err) => {
				reject(err);
			});
			db.once("open", () => {
				User = db.model("users", userSchema);
				resolve();
			});
		});
	},
	registerUser: (userData) => {
		return new Promise((resolve, reject) => {
			if (userData.password != userData.password2) {
				reject(`Passwords do not match`);
			} else {
				bcrypt
					.hash(userData.password, 10)
					.then((hash) => {
						userData.password = hash;
					})
					.then(() => {
						let newUser = new User(userData);
						newUser
							.save()
							.then(resolve)
							.catch((err) => {
								if (err.code == 11000) {
									reject(`User Name already taken`);
								} else {
									reject(`There was an error creating the user: ${err}`);
								}
							});
					})
					.catch(() => {
						reject(`There was an error encrypting the password`);
					});
			}
		});
	},
	checkUser: (userData) => {
		return new Promise((resolve, reject) => {
			User.find({ userName: userData.userName })
				.then((users) => {
					if (!users.length) {
						reject(`Unable to find user: ${userData.userName}`);
					} else {
						bcrypt.compare(userData.password, users[0].password).then((result) => {
							if (!result) {
								reject(`Incorrect password for user: ${userData.userName}`);
							} else {
								users[0].loginHistory.push({
									dateTime: new Date().toString(),
									userAgent: userData.userAgent,
								});
								User.updateOne(
									{ userName: users[0].userName },
									{
										$set: {
											loginHistory: users[0].loginHistory,
										},
									}
								)
									.then(() => {
										resolve(users[0]);
									})
									.catch((err) => {
										reject(`There was an error verifying the user: ${err}`);
									});
							}
						});
					}
				})
				.catch(() => {
					reject(`Unable to find user: ${userData.userName}`);
				});
		});
	},
};
