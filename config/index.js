process.env.NODE_ENV = process.env.NODE_ENV || 'development';
var env = process.env.NODE_ENV;
var fs = require('fs');
var _ = require('lodash');
var path = require('path');
var secret = require('./secret');
var {URL} = require('url');

console.log('Loading config...');

const appURL = new URL(secret.domain[env]);
exports.app = {
  protocol: appURL.protocol,
  hostname: appURL.hostname
};

// helper function to produce url prefixes
Object.defineProperty(exports.app, 'externalUrlPrefix', {
  get: function () {
    var port = '';
    if (process.env.NODE_ENV === 'development' && process.env.PORT !== '80'){
      port = ':' + process.env.PORT;
      return this.protocol + '//' + this.hostname + port;
    }
    return 'https://' + this.hostname + port;
  }
});

// export configurations
exports.db = secret.database;

// export routes
fs.readdirSync(__dirname)
  .filter(function(file) {
    var filename = path.parse(file).base;
    return filename.indexOf('routes') === 0;
  })
  .map(function (file) {
    var info = file.split('.');
    var version = info[2] ? info[1] : '';
    exports['routes.' + version] = require('./' + file);
  });


exports.filters = require('./filters');
_.extend(exports, require('./app')); 
