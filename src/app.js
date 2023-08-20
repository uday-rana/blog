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
app.engine(
  `.hbs`,
  ExpressHandlebars.engine({
    extname: `.hbs`,
    helpers: {
      navLink: (url, options) => {
        return `<a href="${url}"
        ${
          url.split(`/`)[1] == app.locals.activeRoute.split(`/`)[1]
            ? 'class="active"'
            : ""
        }">${options.fn(this)}</a>`;
      },
      categoryLink: (categoryObj) => {
        if (categoryObj) {
          return `<a href="/blog?category=${categoryObj.dataValues.id}"
        ${
          categoryObj.dataValues.id == app.locals.viewingCategory
            ? 'class="active"'
            : ""
        }>${categoryObj.dataValues.category}</a>`;
        }
      },
      equal: function (lvalue, rvalue, options) {
        if (arguments.length < 3) {
          throw new Error(`Handlebars Helper equal needs 2 parameters`);
        }
        if (lvalue != rvalue) {
          return options.inverse(this);
        } else {
          return options.fn(this);
        }
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
  })
);
app.set(`view engine`, `.hbs`);

// Configure middleware
app.use(express.static(`public`));
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
  const route = req.path.substring(1);
  app.locals.activeRoute = `/${
    isNaN(route.split(`/`)[1])
      ? route.replace(/\/(?!.*)/, ``)
      : route.replace(/\/(.*)/, ``)
  }`;
  app.locals.viewingCategory = req.query.category;
  next();
});

function ensureLogin(req, res, next) {
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    next();
  }
}

// Routes
app.get(`/`, (req, res) => res.redirect(`/blog`));

app.get(`/about`, (req, res) => res.render(`about`));

app.get(`/blog`, async (req, res) => {
  let viewData = {};
  // Add posts and pagination data to viewData
  try {
    viewData.allPosts = [];
    if (req.query.category) {
      viewData.allPosts = await blogService.getPublishedPostsByCategory(
        req.query.category
      );
    } else {
      viewData.allPosts = await blogService.getPublishedPosts();
    }
    viewData.allPosts.sort(
      (a, b) => new Date(b.postDate) - new Date(a.postDate)
    );
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
    const categories = await blogService.getCategories();
    viewData.categories = categories;
    viewData.currPosts.forEach((post) => {
      post.dataValues.category = categories.find(
        (e) => e.id == post.dataValues.category
      ).dataValues;
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
      viewData.allPosts = await blogService.getPublishedPostsByCategory(
        req.query.category
      );
    } else {
      viewData.allPosts = await blogService.getPublishedPosts();
    }
    viewData.allPosts.sort(
      (a, b) => new Date(b.postDate) - new Date(a.postDate)
    );
  } catch (err) {
    // Do nothing
  }
  // Add post matching id query to viewData
  try {
    viewData.currPosts = [await blogService.getPostById(req.params.id)];
  } catch (err) {
    viewData.noPostsMessage = `No results`;
  }
  // Add categories to viewData
  try {
    const categories = await blogService.getCategories();
    viewData.categories = categories;
    viewData.currPosts.forEach((post) => {
      post.dataValues.category = categories.find(
        (e) => e.id == post.dataValues.category
      ).dataValues;
    });
  } catch (err) {
    viewData.noCategoriesMessage = `No results`;
  }
  res.render(`blog`, { data: viewData });
});

app.get(`/posts`, ensureLogin, async (req, res) => {
  try {
    let posts = [];
    if (req.query.category) {
      posts = await blogService.getPostsByCategory(req.query.category);
    } else if (req.query.minDate) {
      posts = await blogService.getPostsByMinDate(req.query.minDate);
    } else {
      posts = await blogService.getAllPosts();
    }
    if (posts.length > 0) {
      posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));
      res.render(`posts`, { data: posts });
    } else {
      res.render(`posts`, { message: `No results` });
    }
  } catch (error) {
    res.render(`posts`, { message: `No results` });
  }
});

app.get(`/posts/add`, ensureLogin, async (req, res) => {
  try {
    const categories = await blogService.getCategories();
    res.render(`addPost`, { categories: categories });
  } catch (error) {
    res.render(`addPost`, { categories: [] });
  }
});

app.post(
  `/posts/add`,
  ensureLogin,
  upload.single(`featureImage`),
  (req, res) => {
    function processPost(imageUrl) {
      req.body.featureImage = imageUrl;
      blogService.addPost(req.body).then(res.redirect(`/posts`));
    }

    async function streamUpload(req) {
      return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream((error, result) => {
          if (result) {
            resolve(result);
          } else {
            reject(error);
          }
        });

        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    }

    async function upload(req) {
      let result = await streamUpload(req);
      console.log(result);
      return result;
    }

    if (req.file) {
      upload(req).then((uploaded) => {
        processPost(uploaded.url);
      });
    } else {
      processPost(``);
    }
  }
);

app.get(`/posts/:id`, ensureLogin, async (req, res) => {
  try {
    let posts = [];
    const post = await blogService.getPostById(req.params.id);
    posts.push(post);
    res.render(`posts`, { data: posts });
  } catch (error) {
    res.render(`posts`, { message: `No results` });
  }
});

app.get(`/categories`, ensureLogin, async (req, res) => {
  try {
    const categories = await blogService.getCategories();
    if (categories.length > 0) {
      res.render(`categories`, { data: categories });
    } else {
      res.render(`categories`, { message: `No results` });
    }
  } catch (error) {
    res.render(`categories`, { message: error });
  }
});

app.get(`/categories/add`, ensureLogin, (req, res) =>
  res.render(`addCategory`)
);

app.post(`/categories/add`, ensureLogin, async (req, res) => {
  await blogService.addCategory(req.body);
  res.redirect(`/categories`);
});

app.get(`/categories/delete/:id`, ensureLogin, async (req, res) => {
  try {
    await blogService.deleteCategoryById(req.params.id);
    res.redirect(`/categories`);
  } catch (error) {
    res.status(500).send(`Unable to remove Category / Category not found`);
  }
});

app.get(`/posts/delete/:id`, ensureLogin, async (req, res) => {
  try {
    await blogService.deletePostById(req.params.id);
    res.redirect(`/posts`);
  } catch (error) {
    res.status(500).send(`Unable to remove Post / Post not found`);
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
