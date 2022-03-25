const {USER_TYPES} = require('../config/constant');
module.exports = {
  up: function(migration, DataTypes) {
    return migration.createTable('Users', {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      role: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: USER_TYPES.USER
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true
      },
      google_id: {
        type: DataTypes.STRING,
        allowNull: true
      },
      ip_count: {
        type: DataTypes.INTEGER
      },
      login_count: {
        type: DataTypes.INTEGER
      },
      fp_auth_token: {
        type: DataTypes.STRING
      },
      status: {
        type: DataTypes.STRING
      },
      note: {
        type: DataTypes.STRING
      }
    });
  },
  down: function(migration, DataTypes) {
    return migration.dropTable('Users');
  }
};
