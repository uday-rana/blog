import app from "./app.js";
import blogService from "./blog-service.js";
import authService from "./auth-service.js";

const HTTP_PORT = process.env.PORT || 8080;

function onHTTPStart() {
  console.log(`Server listening on ${HTTP_PORT}`);
}

async function run() {
  try {
    await blogService.initialize();
    await authService.initialize();
    app.listen(HTTP_PORT, onHTTPStart);
  } catch (error) {
    console.error(error);
  }
}

run();
