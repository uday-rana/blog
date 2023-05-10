const Sequelize = require(`sequelize`);
const { gte } = Sequelize.Op;
let sequelize = new Sequelize(process.env.ELEPHANTSQL_USER, process.env.ELEPHANTSQL_USER, process.env.ELEPHANTSQL_PASS, {
	host: `raja.db.elephantsql.com`,
	dialect: `postgres`,
	port: 5432,
	dialectOptions: {
		ssl: { rejectUnauthorized: false },
		query: { raw: true },
	},
});

let Post = sequelize.define(`post`, {
	body: Sequelize.TEXT,
	title: Sequelize.STRING,
	postDate: Sequelize.DATE,
	featureImage: Sequelize.STRING,
	published: Sequelize.BOOLEAN,
});

let Category = sequelize.define(`category`, {
	category: Sequelize.STRING,
});

Post.belongsTo(Category, { foreignKey: `category`, as: `categoryAssoc` });

module.exports = {
	initialize: () => {
		return new Promise((resolve, reject) => {
			sequelize
				.sync()
				.then(() => {
					resolve();
				})
				.catch((err) => {
					reject(`Unable to sync the database`);
				});
		});
	},
	getAllPosts: () => {
		return new Promise((resolve, reject) => {
			Post.findAll()
				.then((data) => {
					resolve(data);
				})
				.catch((err) => {
					reject(`No results returned`);
				});
		});
	},
	getPostsByCategory: (catToFind) => {
		return new Promise((resolve, reject) => {
			Post.findAll({ where: { category: catToFind } })
				.then((data) => {
					resolve(data);
				})
				.catch((err) => {
					reject(`No results returned`);
				});
		});
	},
	getPostsByMinDate: (minDateStr) => {
		return new Promise((resolve, reject) => {
			Post.findAll({ where: { postDate: { [gte]: new Date(minDateStr) } } })
				.then((data) => {
					resolve(data);
				})
				.catch((err) => {
					reject(`No results returned`);
				});
		});
	},
	getPostById: (idToFind) => {
		return new Promise((resolve, reject) => {
			Post.findAll({ where: { id: idToFind } })
				.then((data) => {
					resolve(data[0]);
				})
				.catch((err) => {
					reject(`No results returned`);
				});
		});
	},
	addPost: (postData) => {
		return new Promise((resolve, reject) => {
			postData.published = postData.published ? true : false;
			postData.postDate = new Date();
			for (const key in postData) {
				if (key == ``) {
					key = null;
				}
			}
			Post.create(postData)
				.then(() => {
					resolve();
				})
				.catch((err) => {
					reject(`Unable to create post`);
				});
		});
	},
	getPublishedPosts: () => {
		return new Promise((resolve, reject) => {
			Post.findAll({ where: { published: true } })
				.then((data) => {
					resolve(data);
				})
				.catch((err) => {
					reject(`No results returned`);
				});
		});
	},
	getPublishedPostsByCategory: (catToFind) => {
		return new Promise((resolve, reject) => {
			Post.findAll({ where: { published: true, category: catToFind } })
				.then((data) => {
					resolve(data);
				})
				.catch((err) => {
					reject(`No results returned`);
				});
		});
	},
	getCategories: () => {
		return new Promise((resolve, reject) => {
			Category.findAll()
				.then((data) => {
					resolve(data);
				})
				.catch((err) => {
					reject(`No results returned`);
				});
		});
	},
	addCategory: (categoryData) => {
		return new Promise((resolve, reject) => {
			for (const key in categoryData) {
				if (key == ``) {
					key = null;
				}
			}
			Category.create(categoryData)
				.then(() => {
					resolve();
				})
				.then(() => {
					reject(`Unable to create category`);
				});
		});
	},
	deleteCategoryById: (idToFind) => {
		return new Promise((resolve, reject) => {
			Category.destroy({ where: { id: idToFind } })
				.then(() => {
					resolve();
				})
				.catch((err) => {
					reject(`Unable to delete category`);
				});
		});
	},
	deletePostById: (idToFind) => {
		return new Promise((resolve, reject) => {
			Post.destroy({ where: { id: idToFind } })
				.then(() => {
					resolve();
				})
				.catch((err) => {
					reject(`Unable to delete post`);
				});
		});
	},
};
