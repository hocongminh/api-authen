var passport = require('passport');
var Sequelize = require('sequelize');
var _ = require('lodash');
var bcrypt = require('bcrypt');
var config = require('./');
var models = require('../models');
const utils =  require('../utils');
passport.serializeUser(function (user, done) {
  done(null, user.id);
});
passport.deserializeUser(function (id, done) {
  // Find the user with the given id
  return utils.deserializeUser(id).then(function (user) {
    return done(null, user);
  }).catch(function (err) {
    return done(err);
  });
});

// Configure passport strategies:

var LocalStrategy = require('passport-local').Strategy;
var JwtStrategy = require('passport-jwt').Strategy;
var ExtractJwt = require('passport-jwt').ExtractJwt;
var GoogleStrategy = require('passport-google-oauth20').Strategy;

passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true
  },
  function (req, email, password, done) {
    User.findOne({
      where: {
        email: email.toLowerCase(),
      }
    }).then(function (user) {
      if (!user) {
        done(null, false, { message: 'Incorrect email or password.' });
      } else {
        if (!user.password) {
          if (user.google_id) {
            done(null, false, { message: 'Please log in with Google.' });
          }
        } else {
          // Check the password
          bcrypt.compare(password, user.password, function (err, res) {
            if (err) {
              // Server error
              done(err);
            } else if (res) {
              // Hashes match
              done(null, user);
            } else {
              done(null, false, { message: 'Incorrect email or password.' });
            }
          });
        }
      }
    }, function (err) {
      // Server error
      done(err);
    });
  }

));

// oauth configuration
const secret = require('./secret');
const googleAuth = _.clone(secret.googleAuthentication[process.env.NODE_ENV]);
googleAuth.callback_url = config.app.externalUrlPrefix + '/api/auth/google/callback';

function googleSignup(req, profile, done) {
  // extract google profile info
  const profileEmail = profile.emails ? profile.emails[0].value : profile.username ? profile.username : profile.id + '@gmail.com';
  const profileName = profile.displayName ? profile.displayName : profileEmail.split('@')[0];
  const profileId = profile.id;

  // Check if there already exists a user with the given google ID or email
  return User.findOne({
    where: Sequelize.or({google_id: profileId}, {email: profileEmail})
  })
    .then(function (user) {
      if (user) {
        // ok if google ids match
        if (user.google_id === profileId)
          return done(null, user);
        // otherwise emails match, so fail
        return done(null, false, {message: "Another user has the email '" + profileEmail + "'. If you have already signed up with this email, then please log in instead."});
      }
      return models.transaction(function (t) {
        // create the new user
        return User.create({
          name: profileName,
          email: profileEmail,
          google_id: profileId
        }, {transaction: t})
          .then(function (user) {
            return Profile.create({
              user_id: user.id
            }, {transaction: t})
              .then(function () {
                return done(null, user);
              });
          }).catch(err => {

          });
      });
    })
    .catch(function (err) {
      done(err);
    });
}

function googleLogin(req, profile, done) {
  // Find the user with the given google profile id
  User.findOne({ where: { google_id: profile.id }}).then(function (user) {
    if (user) {
      done(null, user);
    } else {
      done(null, false, { message: 'You have not signed up with this Google account.' });
    }
  }, function (err) {
    done(err);
  });
}

passport.use(new GoogleStrategy({
  clientID: googleAuth.client_id,
  clientSecret: googleAuth.client_secret,
  callbackURL: googleAuth.callback_url,
  passReqToCallback: true,
  profileFields: ['id', 'email', 'displayName', 'name']
}, function (req, accessToken, refreshToken, profile, done) {
    if (req.user) {
      return done(null, req.user);
    }
    if (req.session.googleSignup) {
      googleSignup(req, profile, done);
    } else {
      googleLogin(req, profile, done);
    }
  }
));

passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromHeader('token'),
  secretOrKey: secret.api_secret,
  passReqToCallback: true
}, function(req, decoded, done) {
  if (!req.headers.appkey || req.headers.appkey !== req.app.get('apiSecret')) {
    return done(null, false);
  }
  User.findByPk(decoded.user.id).then(function(user) {
    if (user) {
      return done(null, user);
    }
    return done(null, false);
  }).catch(function (err) {
    return done(err, false);
  });
}));
