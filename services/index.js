const fs = require('fs');
const path = require('path');
fs
  .readdirSync(__dirname)
  .filter(function (file) {
    return (file.indexOf('.') !== 0) && (file !== 'index.js') && (file.indexOf('Service.js') > -1);
  })
  .forEach(function (file) {
    var service =  require(path.join(__dirname, file));
    var name = path.basename(file, '.js');
    global[name] = service;
  });