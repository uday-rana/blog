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
    },
    query: { raw: true },
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
  getPostsByCategory: async (categoryToFind) => {
    try {
      return await Post.findAll({ where: { category: categoryToFind } });
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
  getPostById: async (postID) => {
    try {
      const post = await Post.findByPk(postID);
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
  getPublishedPostsByCategory: async (categorytoFind) => {
    try {
      return await Post.findAll({
        where: { published: true, category: categorytoFind },
      });
    } catch (error) {
      console.error(error);
    }
  },
  updatePost: async (postID, postData) => {
    try {
      if (postID && postData) {
        for (let key in postData) {
          if (key == "") {
            key = null;
          }
        }
        // This is ugly but the alternative is using .set() which requires
        // removing query:{raw:true} from the Sequelize config and inserting
        // ".dataValues." into every single .hbs file and view data object.
        if (postData.removeImage) {
          // Remove image
          await Post.update(
            {
              body: postData.body,
              title: postData.title,
              postDate: new Date(),
              published: postData.published,
              category: postData.category,
              featureImage: "",
            },
            { where: { id: postID } },
          );
        } else if (postData.featureImage) {
          // Change image
          await Post.update(
            {
              body: postData.body,
              title: postData.title,
              postDate: new Date(),
              published: postData.published,
              category: postData.category,
              featureImage: postData.featureImage,
            },
            { where: { id: postID } },
          );
        } else {
          // Keep current image
          await Post.update(
            {
              body: postData.body,
              title: postData.title,
              postDate: new Date(),
              published: postData.published,
              category: postData.category,
            },
            { where: { id: postID } },
          );
        }
      }
    } catch (error) {
      console.error(error);
    }
  },
  deletePostById: async (categoryID) => {
    try {
      await Post.destroy({ where: { id: categoryID } });
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
  getCategories: async () => {
    try {
      return await Category.findAll();
    } catch (error) {
      console.error(error);
    }
  },
  getCategoryById: async (categoryID) => {
    try {
      return await Category.findByPk(categoryID);
    } catch (error) {
      console.error(error);
    }
  },
  updateCategory: async (categoryID, categoryData) => {
    try {
      if (categoryID && categoryData) {
        for (let key in categoryData) {
          if (key == ``) {
            key = null;
          }
        }
        await Category.update(
          { category: categoryData.category },
          { where: { id: categoryID } },
        );
      }
    } catch (error) {
      console.error(error);
    }
  },
  deleteCategoryById: async (categoryID) => {
    try {
      await Category.destroy({ where: { id: categoryID } });
    } catch (error) {
      console.error(error);
    }
  },
};

export default blogService;
