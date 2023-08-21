import prisma from "./prisma.js";

const blogService = {
  posts: {
    create: async (postData) => {
      try {
        // Cannot directly pass postData (data: {postData})
        await prisma.post.create({
          data: {
            title: postData.title,
            body: postData.body,
            categoryId: postData.categoryId,
            imageUrl: postData.imageUrl,
            published: postData.published,
            postDate: new Date(),
          },
        });
      } catch (error) {
        console.error(error);
      }
    },
    getAll: async () => {
      try {
        return await prisma.post.findMany({ include: { category: true } });
      } catch (error) {
        console.error(error);
      }
    },
    getByCategoryId: async (categoryIdQuery) => {
      try {
        return await prisma.post.findMany({
          where: { categoryId: categoryIdQuery },
          include: { category: true },
        });
      } catch (error) {
        console.error(error);
      }
    },
    getByMinDate: async (minDateStr) => {
      try {
        return await prisma.post.findMany({
          where: { postDate: { gte: new Date(minDateStr) } },
          include: { category: true },
        });
      } catch (error) {
        console.error(error);
      }
    },
    getById: async (postIdQuery) => {
      try {
        return await prisma.post.findUnique({
          where: { id: postIdQuery },
          include: { category: true },
        });
      } catch (error) {
        console.error(error);
      }
    },
    getPublished: async () => {
      try {
        return await prisma.post.findMany({
          where: { published: true },
          include: { category: true },
        });
      } catch (error) {
        console.error(error);
      }
    },
    getPublishedByCategoryId: async (categoryIdQuery) => {
      try {
        return await prisma.post.findMany({
          where: { published: true, categoryId: categoryIdQuery },
          include: { category: true },
        });
      } catch (error) {
        console.error(error);
      }
    },
    updateById: async (postIdQuery, postData) => {
      try {
        await prisma.post.update({
          where: { id: postIdQuery },
          data: {
            body: postData.body,
            title: postData.title,
            postDate: new Date(),
            published: postData.published,
            categoryId: postData.categoryId,
          },
        });
        if (postData.removeImage) {
          await prisma.post.update({
            where: { id: postIdQuery },
            data: { imageUrl: "" },
          });
        } else if (postData.imageUrl) {
          await prisma.post.update({
            where: { id: postIdQuery },
            data: { imageUrl: postData.imageUrl },
          });
        }
      } catch (error) {
        console.error(error);
      }
    },
    deleteById: async (categoryIdQuery) => {
      try {
        await prisma.post.delete({ where: { id: categoryIdQuery } });
      } catch (error) {
        console.error(error);
      }
    },
  },
  categories: {
    create: async (categoryData) => {
      try {
        await prisma.category.create({ data: categoryData });
      } catch (error) {
        console.error(error);
      }
    },
    getAll: async () => {
      try {
        return await prisma.category.findMany();
      } catch (error) {
        console.error(error);
      }
    },
    getById: async (categoryIdQuery) => {
      try {
        return await prisma.category.findUnique({
          where: { id: categoryIdQuery },
        });
      } catch (error) {
        console.error(error);
      }
    },
    updateById: async (categoryIdQuery, categoryData) => {
      try {
        await prisma.category.update({
          where: { id: categoryIdQuery },
          data: { name: categoryData.name },
        });
      } catch (error) {
        console.error(error);
      }
    },
    deleteById: async (categoryIdQuery) => {
      try {
        await prisma.category.delete({
          where: { id: categoryIdQuery },
        });
      } catch (error) {
        console.error(error);
      }
    },
  },
};

export default blogService;
