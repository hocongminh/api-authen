/**
 * App configuration
 *
 * @module :: App configuration
 * @description :: Contains configuration for application modules.
 */

var fs = require('fs');
var passport = require('passport');
var bcrypt = require('bcrypt');
var swStats = require('swagger-stats');
var _ = require('lodash');
var secret = require('./secret');
const { USER_TYPES } = require('./constant');

_.each(exports.paths, function (p) {
  if (!fs.existsSync(p)) {
    console.log('Creating directory ' + p);
    fs.mkdirSync(p);
  }
});

exports.setCustomMiddleware = function (app) {
  require('./passport');

  // Enable trust proxy
  app.enable('trust proxy');

  // Passport middleware
  app.use(passport.initialize());
  app.use(passport.session()); // must be after express session middleware

  // Flash middleware
  app.use(require('connect-flash')());

  // Make flash messages available to all views by default
  app.use(function (req, res, next) {
    res.locals.info = req.flash('info');
    res.locals.error = req.flash('error'); // used by passport authenticate error messages
    next();
  });
  app.use(swStats.getMiddleware({
    authentication: true,
    elasticsearch: secret.elasticsearch || '',
    uriPath: '/api/swagger-stats',
    onAuthenticate: function (req, username, password) {
      if (!username || !password) {
        return false;
      }
      return User.findOne({
        where: {
          email: username.toLowerCase(),
          role: USER_TYPES.SUPER_ADMIN
        },
      }).then(function (user) {
        if (!user || !user.passwordDigest) {
          return false;
        }
        return new Promise(function (resolve, reject) {
          bcrypt.compare(password, user.passwordDigest, function (err, res) {
            if (err || !res) {
              return resolve(false);
            }
            return resolve(true);
          });
        });
      });
    }
  }));
  // Ensure pagination query params are valid for api routes
  app.use('/api', function (req, res, next) {
    // if pagination params are specified, validate them
    if (!_.isUndefined(req.query.page)) {
      req.query.page = parseInt(req.query.page) || 0;
      req.query.count = parseInt(req.query.count) || 50;
    }
    next();
  });
};
