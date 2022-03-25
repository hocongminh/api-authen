const bcrypt = require('bcrypt');
const Q = require('q');
const models = require('../models');
const sessionService = require('../services/SessionService');

module.exports = {
  apiLocal: function (req, res) {
    console.log("header:" + JSON.stringify(req.headers.appkey));
    console.log(req.app.get('apiSecret'))
    if (!req.headers.appkey || req.headers.appkey !== req.app.get('apiSecret')) {
      return res.status(400).send({success: false, message: 'Authentication failed. Invalid Key.'});
    } else {
        if (!req.body.email) {
          return res.status(400).send({success: false, message: 'Authentication failed. User was not found.'});
        }
        User.findOne({
          where: {email: req.body.email.toLowerCase()},
          include:
          ['profile']
        })
          .then(function (user) {
            if (!user) {
              return res.status(400).send({success: false, message: 'Authentication failed. User was not found.'});
            } else if (!user.passwordDigest) {
              // No password digest, so the user has signed up with Facebook
              return res.status(400).send({success: false, message: 'Please log in with Facebook.'});
            } else {

              // Check the password
              bcrypt.compare(req.body.password, user.passwordDigest, function (err, data) {
                if (err) {
                  // Server error
                  console.error(err.stack);
                  return res.status(400).send({success: false, message: 'Oops! Authentication failed.'});

                } else if (data) {
                  // Hashes match
                  // if user is found and password is right
                  // create a token

                  var token = sessionService.generateJWTToken(req, user, 365);
                  //if there is a temp email
                  if (req.body.tempEmail) {
                    User.findOne({where: {email: req.body.tempEmail}}).then(function (tempUser) {
                      if (tempUser) {
                        //deactivate account
                        tempUser.updateAttributes({email: 'deactivate-' + tempUser.email});
                      }

                      res.json({
                        success: true,
                        message: 'Welcome to Hiko Solution!',
                        user: user,
                        token: token
                      });
                    });
                  } else {
                    // return the information including token as JSON
                    res.json({
                      success: true,
                      message: 'Welcome to Hiko Solution!',
                      user: user,
                      token: token
                    });
                  }

                } else {
                  return res.status(400).send({success: false, message: 'Authentication failed. Incorrect password.'});
                }
              });

            }

          }, function (err) {
            // Server error
            console.error(err.stack);
            return res.status(500).send({success: false, message: 'Oops! Authentication failed.'});

          });

    }
  },
  apiSignup: function (req, res) {
    if (!req.headers.appkey || req.headers.appkey !== req.app.get('apiSecret')) {
      return res.status(400).send({success: false, message: 'Authentication failed. Invalid Key.'});
    } else {
      var name = req.body.username || '';
      var email = (req.body.email || '').toLowerCase();
      var password = req.body.password || '';

      // Check whether any information is missing
      if (name.length === 0) {
        return res.status(400).send({success: false, message: 'Username is required'});
      } else if (email.length === 0) {
        return res.status(400).send({success: false, message: 'Email is required'});
      } else if (password.length === 0) {
        return res.status(400).send({success: false, message: 'Password is required'});
      }

      // Check whether the email address is unique
      // User.findOne({ where: { email: email } })
      User.findOne({where: {email: req.body.email.toLowerCase()}})
        .then(function (user) {
          if (user) {
            return res.status(400).send({success: false, message: 'Email already taken.'});
          }
          // Hash the password
          return Q.nfcall(bcrypt.hash, password, 10).then(function (hash) {
            return models.transaction(function (t) {
              // Create the user
              var user = User.build({
                name: req.body.username,
                email: req.body.email.toLowerCase(),
                password: hash
              });
              return user.save({transaction: t}).then(function (user) {
                // Create the user profile
                return Profile.create({
                  user_id: user.id,
                  year: req.body.year,
                  degree: req.body.position,
                  user_type: req.body.user_type
                }, {transaction: t});
              }).then(function () {
                // Log the user in
                return user;
              });
            }).then(function (user) {
              // Hashes match
              // if user is found and password is right
              // create a token
              var token = sessionService.generateJWTToken(req, user, 365);
                // return the information including token as JSON
                res.send({
                  success: true,
                  message: 'Welcome to Hiko Solution!',
                  user: user,
                  token: token
                });
            });
          });
        }).then(null, function (err) {
        console.error(err.stack);
        return res.status(500).send({success: false, message: 'Oops! Authentication failed.'});

      });

    }
  },
  apiSignupGoogle: function (req, res) {
    if (!req.headers.appkey || req.headers.appkey !== req.app.get('apiSecret')) {
      return res.status(400).send({success: false, message: 'Authentication failed. Invalid Key.'});
    } else {

      // extract google profile info
      var profileEmail = req.body.email ? req.body.email : (req.body.username ? req.body.username : req.body.profileId) + '@gmail.com';
      // console.log("profileEmail:"+profileEmail);
      var profileName = req.body.username;
      var profileId = req.body.profileId;
      if (!profileId || profileId.length === 0) {
        return res.status(400).send({success: false, message: 'ProfileId is required'});
      }
      // Check if there already exists a user with the given google ID
      User.findOne({
        where: {$or: [{google_id: profileId}, {email: profileEmail}]},
        include: ['profile']
      }).then(function (user) {
        if (user) {
          // ok if google ids match
          if (user.google_id === profileId) {
            // Hashes match
            // if user is found and password is right
            // create a token
            var token = sessionService.generateJWTToken(req, user, 365);

            //if there is a temp email
            if (req.body.tempEmail) {
              User.findOne({where: {email: req.body.tempEmail}}).then(function (tempUser) {
                if (tempUser) {
                  //deactivate account
                  tempUser.updateAttributes({email: 'deactivate-' + tempUser.email});
                }

                res.json({
                  success: true,
                  message: 'Welcome to Hiko Solution!',
                  user: user,
                  token: token
                });
              });
            } else {

              // return the information including token as JSON
              res.json({
                success: true,
                message: 'Welcome to Hiko Solution!',
                user: user,
                university: req.body.university,
                token: token
              });
            }
          } else {
            // otherwise emails match, so fail
            return res.status(400).send({
              success: false,
              message: "Another user has the email '" + profileEmail + "'. If you have already signed up with this email, then please log in instead."
            });
          }

        } else {
          return models.transaction(function (t) {
            // create the new user
            return User.create({
              name: profileName,
              email: profileEmail,
              google_id: profileId
            }, {transaction: t}).then(function (user) {
              // create the profile
              return Profile.create({
                user_id: user.id,
                university: req.body.university,
                year: req.body.year,
              }, {transaction: t}).then(function () {
                // return the user object
                return user;
              });
            });
          }).then(function (user) {
            // Hashes match
            // if user is found and password is right
            // create a token
            var token = sessionService.generateJWTToken(req, user, 30);

            //if there is a temp email
            if (req.body.tempEmail) {
              User.findOne({where: {email: req.body.tempEmail}}).then(function (tempUser) {
                if (tempUser) {
                  //deactivate account
                  tempUser.updateAttributes({email: 'deactivate-' + tempUser.email});
                }

                res.json({
                  success: true,
                  message: 'Welcome to Hiko Solution!',
                  user: user,
                  token: token
                });
              });
            } else {
              // return the information including token as JSON
              res.json({
                success: true,
                message: 'Welcome to Hiko Solution!',
                user: user,
                university: req.body.university,
                token: token
              });
            }
          });
        }

      }).then(null, function (err) {
        console.error(err.stack);
        return res.status(500).send({success: false, message: 'Oops! Authentication failed.'});
      });
    }
  },
  apiSigninGoogle: function (req, res) {
    console.log("header:" + JSON.stringify(req.headers.appkey));
    if (!req.headers.appkey || req.headers.appkey !== req.app.get('apiSecret')) {
      return res.status(400).send({success: false, message: 'Authentication failed. Invalid Key.'});
    } else if (!req.body.profileId) {
      return res.status(500).send({success: false, message: 'Oops! Authentication failed.'});
    } else {
      // Find the user with the given Google profile id
      User.findOne({where: {google_id: req.body.profileId}, include:
      [
        'profile'
      ]}).then(function (user) {
        if (user) {
          var token = sessionService.generateJWTToken(req, user, 365);

          //if there is a temp email
          if (req.body.tempEmail) {
            User.findOne({where: {email: req.body.tempEmail}}).then(function (tempUser) {
              if (tempUser) {
                //deactivate account
                tempUser.updateAttributes({email: 'deactivate-' + tempUser.email});
              }

              res.json({
                success: true,
                message: 'Welcome to Hiko Solution!',
                user: user,
                token: token
              });
            });
          } else {
            res.json({
              success: true,
              message: 'Welcome to Hiko Solution!',
              user: user,
              token: token
            });
          }

        } else {
          return res.status(400).send({
            success: false,
            message: 'You have not signed up with this Google account.'
          });
        }
      }, function (err) {
        console.error(err.stack);
        return res.status(500).send({success: false, message: 'Oops! Authentication failed.'});
      });
    }
  }
};

