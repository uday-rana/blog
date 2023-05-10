const HTTP_PORT = process.env.PORT || 8080;

require(`dotenv`).config();
const express = require(`express`);
const multer = require(`multer`);
const exphbs = require(`express-handlebars`);
const clientSessions = require(`client-sessions`);
const cloudinary = require(`cloudinary`).v2;
const streamifier = require(`streamifier`);
const stripJs = require(`strip-js`);
const blog = require(`./blog-service.js`);
const authData = require(`./auth-service.js`);

const app = express();
const upload = multer();

cloudinary.config({
	cloud_name: `dbwolveat`,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
	secure: true,
});

app.engine(
	`.hbs`,
	exphbs.engine({
		extname: `.hbs`,
		helpers: {
			navLink: (url, options) => {
				return `<li class="nav-item"><a href="${url}" class="nav-link mb-1 ${url == app.locals.activeRoute ? " active" : ``}">${options.fn(
					this
				)}</a></li>`;
			},
			equal: (lvalue, rvalue, options) => {
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
				return stripJs(context);
			},
			formatDate: (dateObj) => {
				let year = dateObj.getFullYear();
				let month = (dateObj.getMonth() + 1).toString();
				let day = dateObj.getDate().toString();
				return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
			},
		},
	})
);
app.set(`view engine`, `.hbs`);

app.use(express.static(`public`));
app.use(express.urlencoded({ extended: true }));
app.use(
	clientSessions({
		cookieName: `session`,
		secret: process.env.COOKIE_SECRET,
		duration: 60 * 60 * 1000,
		activeDuration: 15 * 60 * 1000,
	})
);

app.use(function (req, res, next) {
	res.locals.session = req.session;
	next();
});

app.use((req, res, next) => {
	let route = req.path.substring(1);
	app.locals.activeRoute = `/${isNaN(route.split(`/`)[1]) ? route.replace(/\/(?!.*)/, ``) : route.replace(/\/(.*)/, ``)}`;
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

function onHttpStart() {
	console.log(`Express http server listening on ${HTTP_PORT}`);
}

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
			posts = await blog.getPublishedPostsByCategory(req.query.category);
		} else {
			// Obtain the published `posts`
			posts = await blog.getPublishedPosts();
		}
		// sort the published posts by postDate
		posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));
		// get the latest post from the front of the list (element 0)
		let post = posts[0];
		// store the `posts` and `post` data in the viewData object (to be passed to the view)
		viewData.posts = posts;
		viewData.post = post;
	} catch (err) {
		viewData.message = `No results`;
	}
	try {
		// Obtain the full list of `categories`
		let categories = await blog.getCategories();
		// store the `categories` data in the viewData object (to be passed to the view)
		viewData.categories = categories;
		// replace the post's category value with the category object
		viewData.post.dataValues.category = categories.find((e) => e.id == viewData.post.dataValues.category).dataValues;
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
			posts = await blog.getPublishedPostsByCategory(req.query.category);
		} else {
			// Obtain the published `posts`
			posts = await blog.getPublishedPosts();
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
		viewData.post = await blog.getPostById(req.params.id);
	} catch (err) {
		viewData.message = `No results`;
	}
	try {
		// Obtain the full list of `categories`
		let categories = await blog.getCategories();
		// store the `categories` data in the viewData object (to be passed to the view)
		viewData.categories = categories;
		// replace the post's category value with the category object
		viewData.post.dataValues.category = categories.find((e) => e.id == viewData.post.dataValues.category).dataValues;
	} catch (err) {
		viewData.categoriesMessage = `No results`;
	}
	// render the `blog` view with all of the data (viewData)
	res.render(`blog`, { data: viewData });
});

app.get(`/posts`, ensureLogin, (req, res) => {
	new Promise((resolve, reject) => {
		let posts = [];
		if (req.query.category) {
			posts = blog.getPostsByCategory(req.query.category);
		} else if (req.query.minDate) {
			posts = blog.getPostsByMinDate(req.query.minDate);
		} else {
			posts = blog.getAllPosts();
		}
		resolve(posts);
	})
		.then((posts) => {
			if (posts.length > 0) {
				posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));
				// TODO: replace the post's category value with the category object
				// can't do this because .find() does not work asynchronously
				// for (let post of posts) {
				// 	post.dataValues.category = categories.find(e => e.id == post.dataValues.category).dataValues;
				// }
				res.render(`posts`, { data: posts });
			} else {
				res.render(`posts`, { message: `No results` });
			}
		})
		.catch(() => res.render(`posts`, { message: `No results` }));
});

app.get(`/posts/add`, ensureLogin, (req, res) => {
	blog.getCategories()
		.then((data) => {
			res.render(`addPost`, { categories: data });
		})
		.catch(() => {
			res.render(`addPost`, { categories: [] });
		});
});

app.post(`/posts/add`, ensureLogin, upload.single(`featureImage`), (req, res) => {
	if (req.file) {
		let streamUpload = (req) => {
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
		};

		async function upload(req) {
			let result = await streamUpload(req);
			console.log(result);
			return result;
		}

		upload(req).then((uploaded) => {
			processPost(uploaded.url);
		});
	} else {
		processPost(``);
	}

	function processPost(imageUrl) {
		req.body.featureImage = imageUrl;
		blog.addPost(req.body).then(res.redirect(`/posts`));
	}
});

app.get(`/posts/:id`, ensureLogin, (req, res) => {
	let posts = [];
	blog.getPostById(req.params.id)
		.then((post) => {
			posts.push(post);
			res.render(`posts`, { data: posts });
		})
		.catch(() => res.render(`posts`, { message: `No results` }));
});

app.get(`/categories`, ensureLogin, (req, res) => {
	blog.getCategories()
		.then((categories) => {
			if (categories.length > 0) {
				res.render(`categories`, { data: categories });
			} else {
				res.render(`categories`, { message: `No results` });
			}
		})
		.catch((rejectMsg) => res.render(`categories`, { message: rejectMsg }));
});

app.get(`/categories/add`, ensureLogin, (req, res) => res.render(`addCategory`));

app.post(`/categories/add`, ensureLogin, (req, res) => {
	blog.addCategory(req.body).then(res.redirect(`/categories`));
});

app.get(`/categories/delete/:id`, ensureLogin, (req, res) => {
	blog.deleteCategoryById(req.params.id)
		.then(res.redirect(`/categories`))
		.catch((err) => {
			res.status(500).send(`Unable to Remove Category / Category not found`);
		});
});

app.get(`/posts/delete/:id`, ensureLogin, (req, res) => {
	blog.deletePostById(req.params.id)
		.then(res.redirect(`/posts`))
		.catch((err) => {
			res.status(500).send(`Unable to Remove Post / Post not found`);
		});
});

app.get(`/login`, (req, res) => res.render(`login`));

app.get(`/register`, (req, res) => res.render(`register`));

app.post(`/register`, (req, res) => {
	authData
		.registerUser(req.body)
		.then(() => {
			res.render(`register`, { successMessage: `User created` });
		})
		.catch((err) => {
			res.render(`register`, {
				errorMessage: err,
				userName: req.body.userName,
			});
		});
});

app.post(`/login`, (req, res) => {
	req.body.userAgent = req.get(`User-Agent`);
	authData
		.checkUser(req.body)
		.then((user) => {
			req.session.user = {
				userName: user.userName,
				email: user.email,
				loginHistory: user.loginHistory,
			};
			res.redirect(`/posts`);
		})
		.catch((err) => {
			res.render(`login`, { errorMessage: err, userName: req.body.userName });
		});
});

app.get(`/logout`, (req, res) => {
	req.session.reset();
	res.redirect(`/`);
});

app.get(`/userHistory`, ensureLogin, (req, res) => {
	res.render(`userHistory`);
});

app.use((req, res) => res.status(404).render(`404`));

blog.initialize()
	.then(authData.initialize)
	.then(() => app.listen(HTTP_PORT, onHttpStart))
	.catch((rejectMsg) => console.log(rejectMsg));
