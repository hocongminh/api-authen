/**
 * Session model
 *
 * @module :: Session model
 * @description :: Contains logic for object attributes and associations.
 */
var utils = require('../utils.js');
const redis = require('redis');
const {promisify} = require('util');
const secret = require('../config/secret');
const client = redis.createClient(secret.redis);
client.connect();
const pfaddAsync = promisify(client.pfadd).bind(client);
const pfcountAsync = promisify(client.pfcount).bind(client);

module.exports = function(sequelize, DataTypes) {
	return sequelize.define('Session', {
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
	}, {
		timestamps: false,

		associate: function() {
			Session.belongsTo(User, { foreignKey: 'user_id' });
		},
		hooks: {
			afterCreate: function (instance, options) {
        return User.increment("login_count", {where: { id: instance.user_id}})
					.then(function () {
            return pfaddAsync(`IP_COUNT:${instance.user_id}`, instance.ip)
              .then((result) => {
                return pfcountAsync(`IP_COUNT:${instance.user_id}`).then((count) => {
                  return User.update({
                    ip_count: count
                  }, {
                    where: {id: instance.user_id}
                  })
                })
              });
					})
					.then(function () {
            utils.detectAbnormal(instance.user_id);
          })
          .catch(function (err) {
            console.log(err);
            return utils.sendError('Hook-Session-afterCreate', err);
          });
			}
		}
	});
};
