module.exports = {
  up: function(migration, DataTypes) {
    return migration.createTable('Profiles', {
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      year: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      degree: {
        type: DataTypes.STRING,
        allowNull: true
      },
      picture: {
        type: DataTypes.STRING,
        allowNull: true
      },
      referral: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      user_type: {
        type: DataTypes.STRING,
        allowNull: true
      }
    });
  },
  down: function(migration, DataTypes) {
    return migration.dropTable('Profiles');
  }
};
