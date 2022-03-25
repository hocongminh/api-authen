const _ = require('lodash');
const fs = require('fs');
const {URL} = require('url');
const path = require('path');
const color = require('cli-color');
const moment = require('moment');
// express and friends
const morgan = require('morgan');
const express = require('express');
const bodyParser = require('body-parser');
const compression = require('compression');
const errorHandler = require('errorhandler');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const expressSession = require('express-session');
// set default values for environment
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.PORT = process.env.PORT || 3000;
const env = process.env.NODE_ENV;
console.log('Environment:', color.green(env));
const RedisStore = require('connect-redis')(expressSession);
const redis = require('redis');
const app = express();
const secret = require('./config/secret');
const utils = require('./utils');
// load application configuration
const config = require('./config');
const HOST_NAME = new URL(secret.domain[env]).hostname;

// load models into the global namespace
const models= require('./models');
require('./services');
// load global variables
const globalLoaders = require('./global');

// use jade for view template rendering
app.set('view engine', 'jade');
app.set('apiSecret', secret.api_secret); // secret variable

// handle googlebot requests
app.use(require('prerender-node').set('prerenderToken', 'd6cHTYYzRWfdMXGY3VNT').set('protocol', 'https').set('host', HOST_NAME));
// compress response data with gzip
app.use(compression());

// log requests to stdout
morgan.token('datetime', function(req, res) { return moment().format('YYYY-MM-DD HH:mm:ss ZZ'); });
if (env !== 'test') {
  app.use(morgan(env === 'development' || env === 'test' ? 'dev' : ':datetime | :remote-addr :remote-user :method :url :status :response-time ms'));
}

// in production builds, tell the client to cache these assets for 1 year
const maxAge = 365 * 24 * 60 * 60 * 1000;  // 1 year
app.use(express.static(path.join(__dirname, 'dist'), { maxAge: maxAge }));


// extracts POST data into req.body
app.use(bodyParser.json({limit: '50mb', extended: true}));

// handle file uploads
app.use(function (req, res, next) {
  if (req.method === 'PATCH') {
    req.method = 'PUT';
    req._method = 'PATCH';
  }
  next();
});

app.use(function (req, res, next) {
  if (req._method && req._method === 'PATCH') {
    req.method = 'PATCH';
    delete req._method;
  }
  next();
});

// Allows overriding the http method (verb) if there is a
// '_method' parameter in the body. This enables web browsers
// to submit requests other then GET and POST from a form.
app.use(methodOverride());
const redisClient = redis.createClient(secret.redis)
redisClient.connect();
redisClient.on('error', function (err) {
  console.error('-- REDIS CLIENT ERRORED --', err);
  process.exit(1);
});

// cookie middleware
app.use(cookieParser());
app.use(expressSession({
  store: new RedisStore({ client : redisClient }),
  resave: true,
  saveUninitialized: true,
  secret: '471c0e0b25f61e8ce84189e50367b853',
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' }
}));

// get an instance of the router for api routes
app.use(bodyParser.urlencoded({
  limit: '50mb',
  extended: true,
  parameterLimit: 50000
}));

// load custom middleware
if (_.isFunction(config.setCustomMiddleware))
  config.setCustomMiddleware(app);

// express routing middleware
const router = express.Router({ caseSensitive: true });
utils.setupRoutes(router);
app.use(router);

// fancy error page middleware
app.use(errorHandler());

// utils.setupCronJobs();

Promise.all([
  globalLoaders.init(),
]).then(function () {
  // start the server
  const server = app.listen(process.env.PORT, function () {
    console.log('Server started at ' + color.green('http://localhost:' + process.env.PORT));
  });
  process
    .on('unhandledRejection', (reason, p) => {
      console.log('--internal error--', reason);
    })
    .on('uncaughtException', err => {
      console.log('error', err)
      // utils.sendError('APP-UncatchException', err).then(() => {
      //   process.exit(1);
      // }).catch(() => {
      //   process.exit(1);
      // });
    });
});
module.exports = app;
