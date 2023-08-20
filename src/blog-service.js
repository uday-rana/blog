import Sequelize from "sequelize";

const { gte } = Sequelize.Op;

const sequelize = new Sequelize(
  process.env.ELEPHANTSQL_USER,
  process.env.ELEPHANTSQL_USER,
  process.env.ELEPHANTSQL_PASS,
  {
    host: `raja.db.elephantsql.com`,
    dialect: `postgres`,
    port: 5432,
    dialectOptions: {
      ssl: { rejectUnauthorized: false },
      query: { raw: true },
    },
    logging: false,
  },
);

const Post = sequelize.define(`post`, {
  body: Sequelize.TEXT,
  title: Sequelize.STRING,
  postDate: Sequelize.DATE,
  featureImage: Sequelize.STRING,
  published: Sequelize.BOOLEAN,
});

const Category = sequelize.define(`category`, {
  category: Sequelize.STRING,
});

Post.belongsTo(Category, { foreignKey: `category`, as: `categoryAssoc` });

const blogService = {
  initialize: async () => {
    try {
      await sequelize.sync();
    } catch (error) {
      console.error(error);
    }
  },
  addPost: async (postData) => {
    try {
      postData.published = postData.published ? true : false;
      postData.postDate = new Date();
      for (let key in postData) {
        if (key == "") {
          key = null;
        }
      }
      await Post.create(postData);
    } catch (error) {
      console.error(error);
    }
  },
  getAllPosts: async () => {
    try {
      return await Post.findAll();
    } catch (error) {
      console.error(error);
    }
  },
  getPostsByCategory: async (catToFind) => {
    try {
      return await Post.findAll({ where: { category: catToFind } });
    } catch (error) {
      console.error(error);
    }
  },
  getPostsByMinDate: async (minDateStr) => {
    try {
      return await Post.findAll({
        where: { postDate: { [gte]: new Date(minDateStr) } },
      });
    } catch (error) {
      console.error(error);
    }
  },
  getPostById: async (idToFind) => {
    try {
      const post = await Post.findByPk(idToFind);
      return post;
    } catch (error) {
      console.error(error);
    }
  },
  getPublishedPosts: async () => {
    try {
      return await Post.findAll({ where: { published: true } });
    } catch (error) {
      console.error(error);
    }
  },
  getPublishedPostsByCategory: async (catToFind) => {
    try {
      return await Post.findAll({
        where: { published: true, category: catToFind },
      });
    } catch (error) {
      console.error(error);
    }
  },
  deletePostById: async (idToFind) => {
    try {
      await Post.destroy({ where: { id: idToFind } });
    } catch (error) {
      console.error(error);
    }
  },
  getCategories: async () => {
    try {
      return await Category.findAll();
    } catch (error) {
      console.error(error);
    }
  },
  getCategoryById: async (idToFind) => {
    try {
      return await Category.findByPk(idToFind)
    } catch (error) {
      console.error(error);
    }
  },
  addCategory: async (categoryData) => {
    try {
      for (let key in categoryData) {
        if (key == ``) {
          key = null;
        }
      }
      await Category.create(categoryData);
    } catch (error) {
      console.error(error);
    }
  },
  deleteCategoryById: async (idToFind) => {
    try {
      await Category.destroy({ where: { id: idToFind } });
    } catch (error) {
      console.error(error);
    }
  },
};

export default blogService;
