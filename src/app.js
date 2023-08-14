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
        return `
        <a href="${url}" ${
          url.split(`/`)[1] == app.locals.activeRoute.split(`/`)[1]
            ? 'class="active"'
            : ``
        }">
        ${options.fn(this)}
        </a>
        `;
      },
      categoryLink: (categoryObj) => {
        return `<a href="/blog?category=${categoryObj.dataValues.id}" ${
          categoryObj.dataValues.id == app.locals.viewingCategory
            ? 'class="active"'
            : ""
        }>${categoryObj.dataValues.category}</a>`;
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
        if (context === null || context === "") {
          return null;
        } else {
          context = context.toString();
        }
        return context.replace(/(<([^>]+)>)/gi, "");
      },
      formatDate: (dateObj) => {
        const year = dateObj.getFullYear();
        const month = dateObj.toLocaleString("default", { month: "long" });
        const day = dateObj.getDate().toString();
        return `${day} ${month}, ${year}`;
      },
    },
  }),
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
  }),
);

app.use(function (req, res, next) {
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
  // Declare an object to store properties for the view
  let viewData = {};
  try {
    // declare empty array to hold `post` objects
    let posts = [];
    // if there's a `category` query, filter the returned posts by category
    if (req.query.category) {
      // Obtain the published `posts` by category
      posts = await blogService.getPublishedPostsByCategory(req.query.category);
    } else {
      // Obtain the published `posts`
      posts = await blogService.getPublishedPosts();
    }
    // sort the published posts by postDate
    posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));
    // get the latest post from the front of the list (element 0)
    const post = posts[0];
    // store the `posts` and `post` data in the viewData object (to be passed to the view)
    viewData.posts = posts;
    viewData.post = post;
  } catch (err) {
    viewData.message = `No results`;
  }
  try {
    // Obtain the full list of `categories`
    const categories = await blogService.getCategories();
    // store the `categories` data in the viewData object (to be passed to the view)
    viewData.categories = categories;
    // replace the post's category value with the category object
    viewData.post.dataValues.category = categories.find(
      (e) => e.id == viewData.post.dataValues.category,
    ).dataValues;
  } catch (err) {
    viewData.categoriesMessage = `No results`;
  }
  // render the `blog` view with all of the data (viewData)
  res.render(`blog`, { data: viewData });
});

app.get(`/blog/:id`, async (req, res) => {
  // Declare an object to store properties for the view
  let viewData = {};
  try {
    // declare empty array to hold `post` objects
    let posts = [];
    // if there's a `category` query, filter the returned posts by category
    if (req.query.category) {
      // Obtain the published `posts` by category
      posts = await blogService.getPublishedPostsByCategory(req.query.category);
    } else {
      // Obtain the published `posts`
      posts = await blogService.getPublishedPosts();
    }
    // sort the published posts by postDate
    posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));
    // store the `posts` and `post` data in the viewData object (to be passed to the view)
    viewData.posts = posts;
  } catch (err) {
    viewData.message = `No results`;
  }
  try {
    // Obtain the post by `id`
    viewData.post = await blogService.getPostById(req.params.id);
  } catch (err) {
    viewData.message = `No results`;
  }
  try {
    // Obtain the full list of `categories`
    const categories = await blogService.getCategories();
    // store the `categories` data in the viewData object (to be passed to the view)
    viewData.categories = categories;
    // replace the post's category value with the category object
    viewData.post.dataValues.category = categories.find(
      (e) => e.id == viewData.post.dataValues.category,
    ).dataValues;
  } catch (err) {
    viewData.categoriesMessage = `No results`;
  }
  // render the `blog` view with all of the data (viewData)
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
  },
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
  res.render(`addCategory`),
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
    res.status(500).send(`Unable to Remove Category / Category not found`);
  }
});

app.get(`/posts/delete/:id`, ensureLogin, async (req, res) => {
  try {
    await blogService.deletePostById(req.params.id);
    res.redirect(`/posts`);
  } catch (error) {
    res.status(500).send(`Unable to Remove Post / Post not found`);
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
