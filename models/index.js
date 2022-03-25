
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const Q = require('q');
const config = require('../config');
// make options hash
var options = _.omit(config.db, 'database', 'username', 'password');
options.omitNull = true;

// set sql output logger format function
if (process.env.NODE_ENV === 'development') {
  var color = require('cli-color');
  options.logging = function (text) {
    // split on : if it exists
    var index = text.indexOf(': ');
    if (index >= 0)
      text = text.substr(index + 2);

    if (text.match(/^--/))
      text = color.yellow(text);
    else
      text = color.cyan(text);

    console.log(color.bold('Sequelize: ') + text);
  };
}

// initiate database connection
var sequelize = new Sequelize(config.db.database, config.db.username, config.db.password, options);
// create and export all models
console.log('Loading models...');
global.models = {};

var compulsoryValidations = {
  /*'INTEGER': 'isInt',
  'FLOAT': 'isFloat',
  'DATE': 'isDate'*/
};

fs
  .readdirSync(__dirname)
  .filter(function (file) {
    // skip dot files and this file
    return (file.indexOf('.') !== 0) && (file !== 'index.js');
  })
  .forEach(function (file) {
    // var model = sequelize.import(path.join(__dirname, file));
    var model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    model.snapRelationships = [];
    model.addRelation = (relativeModel, {field, isManyToMany}) => {
      model.snapRelationships.push({
        table: relativeModel,
        field: field || 'id',
        isManyToMany: isManyToMany || false
      })
    }
    // ensure validations are set correctly for each field
    _.forEach(model.rawAttributes, function (options, fieldName) {
      var validate = options.validate || {};
      _.forEach(compulsoryValidations, function (validation, type) {
        if (options.type.toString().match(type) && !validate[validation]) {
          throw Error(model.name + '.' + fieldName + ' has type ' + options.type.toString() + ' but no ' + validation + ' validation');
        }
      });
    });

    // make model accessible globally
    global[model.name] = model;
    models[model.name] = model;
  });

// set associations
Object.keys(models).forEach(function (name) {
  if (models[name].options.hasOwnProperty('associate'))
    models[name].options.associate();
});

module.exports = _.extend({
  transaction: function (fn) {
    return sequelize.transaction({
      isolationLevel: 'READ COMMITTED'
    }).then(function (t) {
      return Q.when(fn(t)).then(function (value) {
        return t.commit().then(function () {
          return value;
        });
      }, function (err) {
        return t.rollback().then(function () {
          throw err;
        });
      });
    });
  },

  sequelize: sequelize,
  Sequelize: Sequelize
}, models);
