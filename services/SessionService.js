const ua = require('useragent');
const color = require('cli-color');
const geoip = require('geoip-lite');
const redis = require('redis');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const secret = require('../config/secret');
const redisClient = redis.createClient(secret.redis);
const { CACHE_KEY } = require('../config/constant');
const SPLIT_KEY = '||'
function getToken(req) {
  return req.headers.token || req.query.token || req.headers['x-access-token'];
}
function embedSession(req, next){
  const token = getToken(req);
  return redisClient.get(`${CACHE_KEY.MobileSession}:${req.user.id}`, function (err, data) {
    if (data) {
      const rawData = data.split(SPLIT_KEY);
      const sessionToken = rawData[1];
      req.session.sessionId = rawData[0];
      if (token !== sessionToken) {
        console.log('INVALID_SESSION');
      }
    }
    return next();
  })
}

module.exports = {
  generateJWTToken: function (req, user, days) {
    const token = jwt.sign({
      user: {
        email: user.email,
        password: user.password,
        id: user.id
      }
    }, req.app.get('apiSecret'), {
      expiresIn: 60 * 60 * 24 * days
    });
    SessionService.log(req, user, token).then(session => {
      redisClient.set(`${CACHE_KEY.MobileSession}:${user.id}`, `${session.id}${SPLIT_KEY}${token}`);
    })
    return token;
  },
  mustLogin: function (req, res, next) {
    if (req.user) {
      return next();
    }
    return passport.authenticate('jwt', { session: false }).call(this, req, res, () => {
      if (req.user && req.session) {
        return embedSession(req, next);
      }
      return next();
    });
  },
  needLogin: function (req, res, next) {
    const token = getToken(req);
    if (req.user || !token) {
      return next();
    }
    return jwt.verify(token, secret.api_secret, function (err, decoded) {
      if (err) {
        return next();
      }
      return User.findOne({
          where: {
            id: decoded.user.id
          },
          attributes: {
            exclude: ['password']
          }
        })
        .then(function (user) {
          req.user = user;
          return embedSession(req, next);
        })
        .catch(function (err) {
          return next();
        });
    });
  },
  log: function (req, user, note) {
    var geolookup = geoip.lookup(req.ip);
    var useragent = ua.lookup(req.headers['user-agent']);

    var agent, device;
    var latitude, longitude;
    var city, region, country;

    agent = device = null;
    latitude = longitude = null;
    city = region = country = null;

    if (useragent !== null) {
      agent = useragent.toAgent();
      device = useragent.os.toString();
    }

    if (geolookup !== null) {
      city = geolookup.city;
      region = geolookup.region;
      country = geolookup.country;
      latitude = geolookup.ll[0];
      longitude = geolookup.ll[1];
    }
    const userEmail = user ? user.email : 'user_undefined';
    return Session.create({
      'user_id': user ? user.id : -1,
      'ip': req.ip,
      'agent': agent,
      'device': device,
      'city': city,
      'region': region,
      'country': country,
      'latitude': latitude,
      'longitude': longitude,
      'note': note || ''
    }).then(function (session) {
      console.log(color.bold.cyan('Session: ') +
        userEmail + ' logged in from ' + req.ip +
        ' using ' + session.agent + ' on ' + session.device);
      return session;
    }).catch((err) => {
      console.error(color.bold.cyan('Session: ') +
        userEmail + ' logged in from ' + req.ip +
        ' ... unable to save other session details; ' + err);
    });
  }
};
