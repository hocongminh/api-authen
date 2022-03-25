/**
 * Profile model
 *
 * @module :: Profile model
 * @description :: Contains logic for object attributes and associations.
 */

const utils = require('../utils');

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('Profile', {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    picture: {
      type: DataTypes.STRING,
      allowNull: true
    },
    year: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    degree: {
      type: DataTypes.STRING,
      allowNull: true,
      set: function(value) {
        if (value)
          value = utils.prettify(value);
        this.setDataValue('degree', value);
      }
    },
    referral: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    user_type: {
      type: DataTypes.ENUM('dev','qc', 'ba', 'pm', 'hr', ''),
      defaultValue: ''
    }
  }, {
    associate: function() {
      Profile.belongsTo(User, { foreignKey: 'user_id' });
    }
  });
};
