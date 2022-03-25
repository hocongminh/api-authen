module.exports = {
  up: function(migration, DataTypes) {
    return migration.createTable('Sessions', {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      start: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      end: {
        type: DataTypes.DATE,
        allowNull: true
      },
      ip: {
        type: DataTypes.STRING,
        allowNull: true
      },
      agent: {
        type: DataTypes.STRING,
        allowNull: true
      },
      device: {
        type: DataTypes.STRING,
        allowNull: true
      },
      city: {
        type: DataTypes.STRING,
        allowNull: true
      },
      region: {
        type: DataTypes.STRING,
        allowNull: true
      },
      country: {
        type: DataTypes.STRING,
        allowNull: true
      },
      latitude: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      longitude: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true
      }
    });
  },
  down: function(migration, DataTypes) {
    return migration.dropTable('Sessions');
  }
};
