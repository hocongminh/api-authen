/**
 * Auth controller
 *
 * @module :: Auth controller
 * @description :: Contains logic for handling requests.
 */

var _ = require('lodash');
var passport = require('passport');
var Q = require('q');
/**
 * Handles the login.
 *
 * @method logInHandler
 */
function logInHandler(user, req) {
  // Log the session
  return SessionService.log(req, user, '').then(function (session) {
    // Regenerate the session to prevent against session fixation
    // and restore the previous session values - fetching new session id
    var oldSession = req.session;
    return Q.ninvoke(req.session, 'regenerate').then(function () {
      // Restore the session values
      _.extend(req.session, oldSession);
      // Log the user in
      return Q.ninvoke(req, 'logIn', user).then(function () {
        // Store session id in session object
        req.session.sessionId = session.id;
      });
    });
  });

}

module.exports = {
  /**
   * Returns the user object if authenticated,
   * otherwise returns unauthorized.
   *
   * @method index
   */
  index: function (req, res) {
    if (req.isAuthenticated()) {
      req.user.passwordDigest = null;
      res.send(req.user);
    } else {
      res.status(401).end();
    }
  },

  /**
   * Terminates the user session.
   *
   * @method destroy
   */
  destroy: function (req, res) {

    Session.update({ end: new Date() }, { where : {
      id: req.session.sessionId
    }});
    req.logout();
    delete req.session.sessionId;
    res.status(200).end();
  },


  /**
   * Handles the local authentication strategy.
   *
   * @method authLocal
   */
  authLocal: function (req, res, next) {
    passport.authenticate('local', function (err, user, info) {
      if (err) {
        return next(err);
      } else if (!user) {
        return res.status(401).send(info);
      }
      // User has been authenticated - now log them in
      logInHandler(user, req).then(function () {
        res.send(user);
      }, function (err) {
        next(err);
      });
    })(req, res, next);
  },

  /**
   * Handles the Google authentication strategy for signup.
   *
   * @method authGoogleSignup
   */
  authGoogleSignup: function (req, res, next) {
    // Indicate that the user is signing up
    // so the callback code performs correctly
    req.session.googleSignup = true;
    // Authenticate with Google
    passport.authenticate('google', {
      scope: ['email', 'profile'],
      display: 'popup'
    })(req, res, next);

  },

  /**
   * Handles the Google authentication callback.
   *
   * @method authGoogleCallback
   */
  authGoogleCallback: passport.authenticate('google', {
    successRedirect: '/api/auth/google/success',
    failureRedirect: '/api/auth/google/failure',
    failureFlash: true
  }),

  /**
   * Handles Google authentication success.
   *
   * @method authGoogleSuccess
   */
  authGoogleSuccess: function (req, res) {
    SessionService.log(req, req.user, '');
    if(req.session.googleSignup){
      res.render('googleSignupSuccess', { user: req.user });
    }else{
      res.render('googleSuccess', { user: req.user });
    }
  },

    /**
   * Handles Google authentication failure.
   *
   * @method authGoogleFailure
   */
  authGoogleFailure: function (req, res) {
    res.render('googleError');
  },

  /**
   * Handles the Google authentication strategy for login.
   *
   * @method authGoogle
   */
  authGoogle: function (req, res, next) {
    // Indicate that the user is logging in
    // so the callback code performs correctly
    delete req.session.googleSignup;
    // Authenticate with Facebook
    passport.authenticate('google', {
      scope: 'email',
      display: 'popup'
    })(req, res, next);
  }
};
