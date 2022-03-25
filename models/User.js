/**
 * User model
 *
 * @module :: User model
 * @description :: Contains logic for object attributes and associations.
 */

const _ = require('lodash');
const utils = require('../utils.js');
const {USER_TYPES} = require('../config/constant');
module.exports = function (sequelize, DataTypes) {
  const U = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: USER_TYPES.USER,
      validate: {
        isIn: [_.values(USER_TYPES)]
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 48]
      },
      set: function (value) {
        if (value)
          value = utils.prettify(value);
        this.setDataValue('name', value);
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        isEmail: true,
        len: [0, 64]
      },
      set: function (value) {
        if (value)
          value = value.toLowerCase();
        this.setDataValue('email', value);
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true
    },
    google_id: {
      type: DataTypes.STRING,
      allowNull: true,
      set: function (value) {
        if (value)
          value = utils.trim(value);
        this.setDataValue('google_id', value);
      }
    },
    ip_count: {
      type: DataTypes.INTEGER,
    },
    login_count: {
      type: DataTypes.INTEGER,
    },
    fp_auth_token: {
      type: DataTypes.STRING
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: false
    },
    note: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    associate: function () {
      
    },
    hooks: {

    }
  });

  U.prototype.toJSON = function () {
    var json = _.clone(this.dataValues);
    delete json.passwordDigest;
    json.href = '/api/users/' + json.id;
    return json;
  };

  return U;
};
