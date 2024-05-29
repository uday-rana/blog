import "dotenv/config";
import express from "express";
import ExpressHandlebars from "express-handlebars";
import client_sessions from "client-sessions";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import streamifier from "streamifier";
import blogService from "./blog-service.js";
import authService from "./auth-service.js";

const app = express();
const upload = multer();

// Configure Cloudinary CDN
cloudinary.config({
  cloud_name: `dbwolveat`,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Configure template engine
const hbs = ExpressHandlebars.create({
  extname: `.hbs`,
  helpers: {
    postLink: (post) => {
      const activeUrl = app.locals.path.split(`/`);
      const activeCategory = app.locals.viewingCategory;
      const postUrl = activeCategory
        ? `/blog/${post.id}?category=${activeCategory}`
        : `/blog/${post.id}`;
      const isActive = activeUrl.length > 2 && post.id == activeUrl[2];
      const activeClass = isActive ? 'class="active"' : "";
      return `<a href="${postUrl}" ${activeClass}>${post.title}</a>`;
    },
    navLink: (url, options) => {
      const isActive = url.split(`/`)[1] == app.locals.path.split(`/`)[1];
      const activeClass = isActive ? 'class="active"' : "";
      return `<a href="${url}" ${activeClass}>${options.fn(this)}</a>`;
    },
    categoryLink: (category) => {
      const categoryUrl = `/blog?category=${category.id}`;
      const isActive = category.id == app.locals.viewingCategory;
      const activeClass = isActive ? 'class="active"' : "";
      return `<a href="${categoryUrl}" ${activeClass}>${category.name}</a>`;
    },
    safeHTML: (context) => {
      if (context) {
        context = context.toString();
        return context.replace(/(<([^>]+)>)/gi, "");
      }
    },
    formatDate: (dateObj) => {
      if (dateObj) {
        const year = dateObj.getFullYear();
        const month = dateObj.toLocaleString("default", { month: "long" });
        const day = dateObj.getDate().toString();
        return `${day} ${month}, ${year}`;
      }
    },
  },
});

app.engine(`.hbs`, hbs.engine);
app.set(`view engine`, `.hbs`);

// Configure app-level middleware
app.use(express.static(`/public`));
app.use(express.urlencoded({ extended: true }));
app.use(
  client_sessions({
    cookieName: `session`,
    secret: process.env.COOKIE_SECRET,
    duration: 60 * 60 * 1000,
    activeDuration: 15 * 60 * 1000,
  })
);
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});
app.use((req, res, next) => {
  app.locals.path = req.path;
  app.locals.viewingCategory = req.query.category;
  next();
});

// Configure route-level middleware
function ensureLogin(req, res, next) {
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    next();
  }
}

// Image upload function
async function streamUpload(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream((error, result) => {
      if (result) {
        resolve(result);
      } else {
        reject(error);
      }
    });

    streamifier.createReadStream(buffer).pipe(stream);
  });
}

// Routes
app.get(`/`, (req, res) => res.redirect(`/blog`));

app.get(`/about`, (req, res) => res.render(`about`));

app.get(`/blog`, async (req, res) => {
  let viewData = {};
  try {
    // Add posts to viewData
    viewData.allPosts = [];
    if (req.query.category) {
      viewData.allPosts = await blogService.posts.getPublishedByCategoryId(
        parseInt(req.query.category)
      );
    } else {
      viewData.allPosts = await blogService.posts.getPublished();
    }
    viewData.allPosts.sort(
      (a, b) => new Date(b.postDate) - new Date(a.postDate)
    );
    // Add pagination data to viewData
    viewData.currPage = parseInt(req.query.page) || 1;
    viewData.showPagination = viewData.allPosts.length > 5;
    viewData.showPrevPageBtn = viewData.currPage > 1;
    viewData.showNextPageBtn = viewData.currPage < viewData.allPosts.length / 5;
    viewData.prevPage = viewData.currPage - 1;
    viewData.nextPage = viewData.currPage + 1;
    viewData.currPosts = viewData.allPosts.slice(
      viewData.currPage * 5 - 5,
      viewData.currPage * 5
    );
  } catch (err) {
    viewData.noPostsMessage = `No results`;
  }
  // Add categories to viewData
  try {
    const categories = await blogService.categories.getAll();
    viewData.categories = categories;
    viewData.currPosts.forEach((post) => {
      post.category = categories.find((e) => e.id == post.categoryId);
    });
  } catch (err) {
    viewData.noCategoriesMessage = `No results`;
  }
  res.render(`blog`, { data: viewData });
});

app.get(`/blog/:id`, async (req, res) => {
  let viewData = {};
  // Add all posts to viewData
  try {
    viewData.allPosts = [];
    if (req.query.category) {
      viewData.allPosts = await blogService.posts.getPublishedByCategoryId(
        parseInt(req.query.category)
      );
    } else {
      viewData.allPosts = await blogService.posts.getPublished();
    }
    viewData.allPosts.sort(
      (a, b) => new Date(b.postDate) - new Date(a.postDate)
    );
  } catch (err) {
    // Do nothing
  }
  // Add post matching id query to viewData
  try {
    viewData.currPosts = [
      await blogService.posts.getById(parseInt(req.params.id)),
    ];
  } catch (err) {
    viewData.noPostsMessage = `No results`;
  }
  // Add categories to viewData
  try {
    const categories = await blogService.categories.getAll();
    viewData.categories = categories;
    viewData.currPosts.forEach((post) => {
      post.category = categories.find((e) => e.id == post.categoryId);
    });
  } catch (err) {
    viewData.noCategoriesMessage = `No results`;
  }
  res.render(`blog`, { data: viewData });
});

app.get(`/posts`, ensureLogin, async (req, res) => {
  try {
    let error;
    if (req.query.error == 1) {
      error = `An error occurred.`;
    }
    let posts = [];
    if (req.query.category) {
      posts = await blogService.posts.getByCategoryId(
        parseInt(req.query.category)
      );
    } else if (req.query.minDate) {
      posts = await blogService.posts.getByMinDate(req.query.minDate);
    } else {
      posts = await blogService.posts.getAll();
    }
    if (posts.length > 0) {
      posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));
      posts.forEach((post) => {
        post.published = post.published.toString();
        post.published =
          post.published.charAt(0).toUpperCase() + post.published.slice(1);
      });
      res.render(`posts`, { posts: posts, error: error });
    } else {
      res.render(`posts`, { message: `No results`, error: error });
    }
  } catch (error) {
    res.render(`posts`, { message: `No results`, error: error });
  }
});

app.get(`/posts/add`, ensureLogin, async (req, res) => {
  try {
    const categories = await blogService.categories.getAll();
    res.render(`postAdd`, { categories: categories });
  } catch (error) {
    res.render(`postAdd`, { categories: [] });
  }
});

app.post(
  `/posts/add`,
  ensureLogin,
  upload.single(`featuredImage`),
  async (req, res) => {
    try {
      req.body.imageUrl = "";
      if (req.file) {
        const image = await streamUpload(req.file.buffer);
        req.body.imageUrl = image.secure_url;
      }
      req.body.categoryId = parseInt(req.body.categoryId);
      req.body.postDate = new Date();
      req.body.published = req.body.published ? true : false;
      for (let key in req.body) {
        if (key == "") {
          key = null;
        }
      }
      await blogService.posts.create(req.body);
      res.redirect(`/posts`);
    } catch (error) {
      res.redirect(`/posts?error=1`);
    }
  }
);

app.get(`/posts/edit/:id`, ensureLogin, async (req, res) => {
  try {
    const post = await blogService.posts.getById(parseInt(req.params.id));
    const categories = await blogService.categories.getAll();
    res.render(`postEdit`, { post: post, categories: categories });
  } catch (error) {
    res.redirect(`/posts?error=1`);
  }
});

app.post(
  `/posts/edit/:id`,
  ensureLogin,
  upload.single(`featuredImage`),
  async (req, res) => {
    try {
      if (req.file && !req.body.removeImage) {
        const image = await streamUpload(req.file.buffer);
        req.body.imageUrl = image.url;
      }
      req.body.categoryId = parseInt(req.body.categoryId);
      req.params.id = parseInt(req.params.id);
      req.body.published = req.body.published ? true : false; // published is undefined unless this is done
      for (let key in req.body) {
        if (key == "") {
          key = null;
        }
      }
      await blogService.posts.updateById(parseInt(req.params.id), req.body);
      res.redirect(`/posts`);
    } catch (error) {
      res.redirect(`/posts?error=1`);
    }
  }
);

app.get(`/posts/delete/:id`, ensureLogin, async (req, res) => {
  try {
    const post = await blogService.posts.getById(parseInt(req.params.id));
    res.render(`postDelete`, { post: post });
  } catch (error) {
    res.redirect(`/posts?error=1`);
  }
});

app.post(`/posts/delete/:id`, ensureLogin, async (req, res) => {
  try {
    await blogService.posts.deleteById(parseInt(req.params.id));
    res.redirect(`/posts`);
  } catch (error) {
    res.redirect(`/posts?error=1`);
  }
});

app.get(`/categories`, ensureLogin, async (req, res) => {
  try {
    let error;
    if (req.query.error == 1) {
      error = `An error occurred.`;
    }
    const categories = await blogService.categories.getAll();
    if (categories.length > 0) {
      categories.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      res.render(`categories`, { categories: categories, error: error });
    } else {
      res.render(`categories`, { message: `No results` });
    }
  } catch (error) {
    res.render(`categories`, { message: error });
  }
});

app.get(`/categories/add`, ensureLogin, (req, res) =>
  res.render(`categoryAdd`)
);

app.post(`/categories/add`, ensureLogin, async (req, res) => {
  try {
    for (let key in req.body) {
      if (key == ``) {
        key = null;
      }
    }
    await blogService.categories.create(req.body);
    res.redirect(`/categories`);
  } catch (error) {
    res.redirect(`/categories?error=1`);
  }
});

app.get(`/categories/edit/:id`, ensureLogin, async (req, res) => {
  try {
    const category = await blogService.categories.getById(
      parseInt(req.params.id)
    );
    res.render(`categoryEdit`, { category: category });
  } catch (error) {
    res.redirect(`/categories?error=1`);
  }
});

app.post(`/categories/edit/:id`, ensureLogin, async (req, res) => {
  try {
    for (let key in req.body) {
      if (key == ``) {
        key = null;
      }
    }
    await blogService.categories.updateById(parseInt(req.params.id), req.body);
    res.redirect(`/categories`);
  } catch (error) {
    res.redirect(`/categories?error=1`);
  }
});

app.get(`/categories/delete/:id`, ensureLogin, async (req, res) => {
  try {
    const category = await blogService.categories.getById(
      parseInt(req.params.id)
    );
    res.render(`categoryDelete`, { category: category });
  } catch (error) {
    res.redirect(`/categories?error=1`);
  }
});

app.post(`/categories/delete/:id`, ensureLogin, async (req, res) => {
  try {
    await blogService.categories.deleteById(parseInt(req.params.id));
    res.redirect(`/categories`);
  } catch (error) {
    res.redirect(`/categories?error=1`);
  }
});

app.get(`/login`, (req, res) => res.render(`login`));

app.get(`/register`, (req, res) => res.render(`register`));

app.post(`/register`, async (req, res) => {
  try {
    await authService.registerUser(req.body);
    res.render(`register`, { successMessage: `User created` });
  } catch (error) {
    res.render(`register`, {
      errorMessage: error,
      userName: req.body.userName,
    });
  }
});

app.post(`/login`, async (req, res) => {
  try {
    req.body.userAgent = req.get(`User-Agent`);
    const user = await authService.checkUser(req.body);
    req.session.user = {
      userName: user.userName,
      email: user.email,
    };

    res.redirect(`/blog`);
  } catch (error) {
    res.render(`login`, { errorMessage: error, userName: req.body.userName });
  }
});

app.get(`/logout`, (req, res) => {
  req.session.reset();
  res.redirect(`/`);
});

app.get(`/loginHistory`, ensureLogin, async (req, res) => {
  const user = await authService.getUser(req.session.user);
  res.render(`loginHistory`, { user: user });
});

app.use((req, res) => res.status(404).render(`404`));

export default app;
