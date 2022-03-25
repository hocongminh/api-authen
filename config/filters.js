const _ = require('lodash');
const utils = require('../utils');
var secret = require('./secret');
const cookieList = ['cookie_id'];
exports.auth = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  else
    return res.status(401).end();
};

exports.leader = function (req, res, next) {
  if (req.isAuthenticated() && utils.isLeader(req.user.role)) {
    return next();
  } else {
    return res.status(401).end();
  }
};

exports.admin = function (req, res, next) {
  if (req.isAuthenticated() && utils.isAdmin(req.user.role)) {
    return next();
  } else {
    return res.status(401).end();
  }
};

exports.supperuser = function (req, res, next) {
  if (req.isAuthenticated() && utils.isSuperUser(req.user.role)) {
    return next();
  } else {
    return res.status(401).end();
  }
};

exports.jwt = function (req, res, next) {
  return SessionService.mustLogin(req, res, next);
};

exports.checkJWT = function (req, res, next) {
  return SessionService.needLogin(req, res, next);
};

exports.anonymous = function (req, res, next) {
  return next();
};

exports.validateDomain = function (req, res, next) {
  const regex = /^[*]/;
  const domains = secret.domains;
  let isValid = false;
  if (req.headers.referer) {
    const host = req.headers.referer.split('/')[2];
    isValid = _.some(domains, function(domain) {
      return regex.test(domain) ? host.includes(domain.substring(1)) : host === domain;
    });
  }
  return isValid;
};

exports.validateUserAgent = function (req, res, next) {
  const userAgents = secret.userAgents.values ? secret.userAgents.values : [];
  const validKeys = secret.userAgents.keys ? secret.userAgents.keys : [];
  let isValid = false;
  _.each(validKeys, key => {
    if (userAgents.includes(req.headers[key])) {
      isValid = true;
    }
  });
  return isValid;
};

exports.userAgentPolicy = function (req, res, next) {
  // return next();
  if (exports.validateDomain(req, res, next) || exports.validateUserAgent(req, res, next)) {
    return next();
  }
  utils.sendError("Hikotech INTERNAL SERVER ERROR", new Error('UserAgent Invalid'), null, utils.requestInfo(req));
  return res.status(401).end();
};

exports.deprecated = function (req, res, next) {
  return res.status(400).send('Deprecated API.');
};

exports.validateCookie = function (req, res, next) {
  if (req.headers.cookie) {
    let cookies = req.headers.cookie.split(';');
    _.each(cookies, (cookie, index) => {
        let parts = cookie.split('=');
        if (parts.length === 2 && cookieList.includes(parts[0].trim())) {
          parts[1] = parts[1].replace(/[^a-zA-Z0-9 ]/g, "");
          cookies[index] = parts.join('=');
        }
    });
    req.headers.cookie = cookies.join(';');
  }
  next();
};
