const fs = require('fs');
const ua = require('useragent');
const path = require('path');
const _ = require('lodash');
const jwt = require('jsonwebtoken');
const slugify = require('slugify');
const secret = require('./config/secret');
const config = require('./config');
const USER_TYPES = require('./config/constant').USER_TYPES;
const titleStopWords = {
  'and': undefined,
  'or': undefined,
  'of': undefined,
  'the': undefined
};
exports.trim = function (s) {
  return s.replace(/^\s+|\s+$/g, '');
};

exports.trimEverywhere = function (s) {
  return s.replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ');
};

exports.capitalize = function (s) {
  return s.charAt(0).toUpperCase() + s.substr(1);
};

exports.isPositiveInteger = function isPositiveInteger(n) {
  return n >>> 0 === parseFloat(n);
};

exports.isEmail = function isEmail(n) {
  const re = /^(?=.{0,64}$)(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(n);
};

exports.titleCase = function (s) {
  var first = true;
  return s.replace(/\w+/g, function (match) {
    match = (!first && _.has(titleStopWords, match.toLowerCase())) ? match : exports.capitalize(match);
    first = false;
    return match;
  });
};

exports.prettify = function (s) {
  s = s
    .replace(/-+/g, '-')       // remove excessive hyphens
    .replace(/\s*-\s*/g, '-')  // remove whitespace around hyphens
    .replace(/^-|-$/g, '');    // remove hyphens from start and end
  return exports.titleCase(exports.trimEverywhere(s));
};

exports.humanize = function (s) {
  return s
    .replace(/([a-z])([A-Z]+)/g, '$1 $2')     // put a space between words bounded by camelcase
    .replace(/_/g, ' ')                       // convert underscores to spaces
    .replace(/(^|\s)(id)($|\s)/gi, '$1ID$3')  // ensure all id words are fully capitalized
    .split(/\s+/)                             // split on whitespace
    .map(exports.capitalize)                  // capitalize each word
    .join(' ');                               // join with a space between each word
};

exports.getFilenameWithoutExtension = function (filePath) {
  var basename = path.basename(filePath);
  return basename.match(/^[^\.]*/)[0];
};

exports.getFilenameExtension = function (filePath) {
  var basename = path.basename(filePath);
  var index = basename.lastIndexOf('.');
  if (index >= 0)
    return basename.substr(index);
  return '';
};

exports.updateSelectedAttributes = function (modelInstance, data, allowedAttrs) {
  var updated = [];

  allowedAttrs.forEach(function (attr) {
    if (!_.isUndefined(data[attr])) {
      modelInstance[attr] = data[attr];
      updated.push(attr);
    }
  });

  return modelInstance.save({ allowNull: updated });
};

exports.stripUndefinedValues = function (obj) {
  _.forOwn(obj, function (value, key) {
    if (typeof value === 'undefined')
      delete obj[key];
  });
  return obj;
};

exports.rawQuery = function (sql, args, options) {
  args = args || [];
  options = options || {};
  options.type = options.type || 'SELECT';
  options.replacements = args;
  return require('./models').sequelize.query(sql, options);
};

exports.rawQueryEx = function (obj, args) {
  var sql = '';

  if (obj.select) sql += 'SELECT ' + obj.select.join(', ');
  if (obj.from) sql += '\nFROM ' + obj.from.join(', ');

  if (obj.join) {
    _.each(obj.join, function (join) {
      sql += '\n' + join;
    });
  }

  if (obj.where) {
    sql += '\nWHERE ' + obj.where.map(function (where) {
      return '(' + where + ')';
    }).join(' AND ');
  }

  if (obj.group) sql += '\nGROUP BY ' + obj.group.join(', ');
  if (obj.order) sql += '\nORDER BY ' + obj.order.join(', ');
  if (obj.limit) sql += '\nLIMIT ' + obj.limit;
  if (obj.offset) sql += '\nOFFSET ' + obj.offset;

  return exports.rawQuery(sql, args);
};

function generateSqlSearchWhereCondition(attrs, query) {
  // split query into individual words

  var words = query.trim().toLowerCase().split(/\s+/);
  var hasAttrs = query.length;
  // make each word suitable for LIKE comparison function
  words = words.map(function (word) {
    if (Date.parse(word) && word.includes('/')) {
      var d = word.split(/\//g).map(function (component) {
        if (component.length == 0 || component.length > 2) {
          return component;
        } else {
          return ("0" + component).slice(-2);
        }
      }).join("-");
      return '%' + d + '%';
    }
    return '%' + word + '%';
  });

  // construct lowercase concatenation of table attributes to be used for like comparison
  var joinedAttrs = 'LOWER(' + attrs.map(function (attr) {
    return 'COALESCE(CAST(' + attr + " AS VARCHAR), '')";
  }).join(" || ' ' || ") + ')';

  // construct search where clause
  var args = {};
  var where = words.map(function (word, i) {
    args['word' + i] = word;
    return '(' + joinedAttrs + ' LIKE :word' + i + ')';
  }).join(' AND ');

  return {
    where: hasAttrs ? where : '',
    args: hasAttrs ? args : {}
  };
}

function mergeArrays(a, b) {
  if (_.isArray(a))
    return a.concat(b);
  return undefined;
}

/**
 * Generetate full-text search logic for PostgresSQL
 *
 * @param {Object} model - Sequelize model
 * @param {Object} query - Text use to search
 * @param {Object} options - Extra options
 * @param {number} options.limit - Limit the data return, default: 20
 * @param {Array} options.fields - List of column use to search
 * @param {Array} options.attributes - List of return attributes
 * @param {Array} options.includes - List of include models - not implement
 */

exports.fulltextSearch = function (model, query, options = {}) {
  // columns use to search

  var searchFields = _.filter(model.rawAttributes, function (value, attr) {
    return ['STRING', 'TEXT'].indexOf(value.type.constructor.name) > -1;
  }).map(function (attr) {
    return `"${model.tableName}"."${attr.fieldName}"`;
  });

  // For simplicity strip out % from the query strings
  query = query.replace(/%/g, '').toLowerCase();

  // Split the query into individual words
  // and prepare words to be used with LIKE
  var words = query.split(/\s+/).map(w => `%${w}%`);

  // construct lowercase concatenation of table attributes to be used for like comparison
  if (options.fields) {
    searchFields = options.fields
      .filter(Boolean)
      .map(x => `"${model.tableName}"."${x}"`);
  }

  var joinedAttrs = searchFields.length ? 'LOWER(' + searchFields.map(function (attr) {
    return 'COALESCE(CAST(' + attr + " AS VARCHAR), '')";
  }).join(" || ' ' || ") + ')' : '';

  // construct search where clause
  var args = {};
  var where = words.map(function (word, i) {
    args['word' + i] = word;
    return joinedAttrs ? '(' + joinedAttrs + ' LIKE :word' + i + ')' : '';
  }).join(' AND ') ;

  var queryObj = {};
  queryObj.select = ['"' + model.tableName + '".*'];
  queryObj.from = ['"' + model.tableName + '"'];
  queryObj.where = where ? [where] : '';
  queryObj.limit = options.limit || 20;

  if (queryObj.where && options.where && options.args) {
    queryObj.where = _.concat(queryObj.where, options.where)
    Object.assign(args, options.args)
  } else {
    Object.assign(args, options.args)
  }
  if (options.attributes) {
    queryObj.select = options.attributes.map(function (sel) {
      if (sel.indexOf(".") > -1) {
        var att = sel.split('.');
        return `"${att[0]}".${att[1]}`;
      }
      return `"${model.tableName}".${sel}`;
    });
  }
  if (options.where) {
    queryObj.where = _.uniq(_.concat(queryObj.where, options.where)).filter(Boolean);
  }
  if (options.join) {
    queryObj.join = options.join;
  }
  return exports.rawQueryEx(queryObj, args);
};


exports.paginateModelRecords = function (req, model, extraQuery, extraArgs, searchAttrs, extraAttrs, countModel) {
  var page = parseInt(req.query.page) || 0;
  var count = parseInt(req.query.count) || 50;
  var query = req.query.q || '';
  var sort = '"' + (req.query.sort || (model.tableName + '"."id')) + '"';
  var nullOrder = req.query.null === 'last' ? 'NULLS LAST' : 'NULLS FIRST';
  var sortDir = parseInt(req.query.dir) ? 'DESC' : 'ASC';
  if (req.query.null) {
    sortDir += ' ' + nullOrder;
  }
  if (req.query.rawSort) {
    sort = req.query.rawSort;
    sortDir = '';
  }
  if (!searchAttrs) {
    searchAttrs = _.filter(model.rawAttributes, function (value, attr) {
      return value.type.constructor.name === 'STRING' || value.type.constructor.name === 'TEXT' || value.type.constructor.name === 'DATE';
    }).map(function (attr) {
      return '"' + model.tableName + '"."' + attr.fieldName + '"';
    });
  }

  // append extra attributes to search attributes
  _.forEach(extraAttrs, function (attr) {
    searchAttrs.push(attr);
  });

  // generate where search condition
  var searchCond = generateSqlSearchWhereCondition(searchAttrs, query);
  // create our query objs
  var queryObj = {};
  queryObj.select = ['"' + model.tableName + '".*'];
  queryObj.from = ['"' + model.tableName + '"'];
  queryObj.where = searchCond.where ? [searchCond.where] : '';
  queryObj.order = [sort + ' ' + sortDir];
  queryObj.limit = count;
  queryObj.offset = page * count;
  var countQueryObj = {};
  countQueryObj.from = queryObj.from;
  countQueryObj.where = queryObj.where;

  if (extraQuery && extraQuery.whereOR) {
    queryObj.where[0] = queryObj.where[0] + ' OR ' + extraQuery.whereOR;
    delete extraQuery.whereOR;
  }

  if (extraQuery) {
    _.mergeWith(queryObj, extraQuery, mergeArrays);
    _.mergeWith(countQueryObj, extraQuery, mergeArrays);
  }

  // these cannot be overridden by the extra query
  countQueryObj.select = ['COUNT(DISTINCT "' + model.tableName + '".id) "count"'];
  if (countModel) {
    countQueryObj.select = ['COUNT(DISTINCT "' + countModel.tableName + '".id) "count"'];
  }
  delete countQueryObj.group;

  // arguments to be escaped
  var args = searchCond.args;

  if (extraArgs) {
    _.extend(args, extraArgs);
  }
  // execute the query
  return Q.spread([
    exports.rawQueryEx(queryObj, searchCond.args),
    exports.rawQueryEx(countQueryObj, searchCond.args)
  ], function (rows, count) {
    return {
      totalCount: count[0].count,
      data: rows
    };
  });
};

function fetchAssociation(from, associatedModel) {
  // get the foreign key
  var property = associatedModel.name.toLowerCase();
  var foreignKey = property + '_id';

  // create a set containing all of the unique keys of the associated model
  // that we want to fetch
  var keys = {};
  _.each(from, function (obj) {
    var id = obj[foreignKey];
    if (!_.isUndefined(id) && !_.isNull(id))
      keys[obj[foreignKey]] = true;
  });

  keys = _.keys(keys);

  // fetch the associated records
  return associatedModel.findAll({ where: { id: keys } }).then(function (records) {
    // map the records by id
    var mapped = {};
    _.each(records, function (record) {
      mapped[record.id] = record;
    });

    // attach the records to the associated objects
    _.each(from, function (obj) {
      if (obj.hasOwnProperty('dataValues'))
        obj.dataValues[property] = mapped[obj[foreignKey]];
      else
        obj[property] = mapped[obj[foreignKey]];
    });

    return from;
  });
}

exports.fetchAssociation = function (from, associatedModel) {
  // ensure from is an array
  if (!_.isArray(from)) {
    return fetchAssociation([from], associatedModel).then(function (from) {
      return from[0];
    });
  } else {
    return fetchAssociation(from, associatedModel);
  }
};

exports.copyFile = function (source, dest) {
  var deferred = Q.defer();

  var rd = fs.createReadStream(source);

  rd.on('error', function (err) {
    deferred.reject(err);
  });

  var wr = fs.createWriteStream(dest);

  wr.on('error', function (err) {
    deferred.reject(err);
  });
  wr.on('close', function (ex) {
    deferred.resolve();
  });

  rd.pipe(wr);

  return deferred.promise.then(null, function (err) {
    // if there was an error, try to delete the file we created
    // but don't sweat it if we can't delete it
    return Q.nfcall(fs.unlink, dest).finally(function () {
      throw err;
    });
  });
};

// get all controller filenames
exports.walkdir = function walkdir(dirpath) {
  var files = fs.readdirSync(dirpath);

  // remove dotfiles
  _.remove(files, function (file) {
    return file.indexOf('.') === 0;
  });

  // filter out the directories
  var dirs = _.remove(files, function (file) {
    return fs.statSync(path.join(dirpath, file)).isDirectory();
  });

  // set full path from dirpath
  files = files.map(function (file) {
    return path.join(dirpath, file);
  });

  // append the nested directory contents
  dirs.forEach(function (dir) {
    files.push.apply(files, walkdir(path.join(dirpath, dir)));
  });

  return files;
};

exports.addRoutes = function (listRoute, router, controllerFilenames, version) {
  // configure routes
  console.log('Setting routes ' + version);
  _.each(listRoute, function (actions, route) {
    // arrayify actions
    if (!_.isArray(actions))
      actions = [actions];

    // split the route into (verb, url) pairs
    var pieces = route.split(' ');
    if (pieces.length !== 2)
      throw Error('Route must be of the form "<verb> <url>"');
    var verb = pieces[0].toLowerCase();
    var url = pieces[1];

    if (version && url) {
      url = url.replace('/api', '/api/' + version);
    }

            // sanity check the verb
    if (!_.includes(['get', 'post', 'delete', 'patch', 'put', 'all'], verb))
      throw Error('Route verb is invalid');

    var action;
    // apply filters
    for (var i = 0; i < actions.length - 1; i++) {
      action = actions[i];
      if (_.isFunction(action)) {
        router[verb](url, action);
        continue;
      }
      // check that the filter exists
      if (!_.isFunction(config.filters[action]))
        throw Error('No such filter called "' + action + '"');

      // apply the filter to this route
      router[verb](url, config.filters[action]);
    }

    // get the controller action
    action = actions[actions.length - 1];

    // split the action into (controller, method) pairs
    pieces = action.split('.');
    if (pieces.length !== 2)
      throw Error('Last route action must be of the form "<controller>.<method>"');
    var controllerName = pieces[0];
    var methodName = pieces[1];

    // load the controller
    var controllerFilename = controllerName + '.js';
    if (!(controllerFilename in controllerFilenames))
      throw Error('No such controller called "' + controllerName + '"');
    var controller = require('./' + controllerFilenames[controllerName + '.js']);

    // check that the method exists on the controller
    if (!_.isFunction(controller[methodName]))
      throw Error('"' + methodName + '" is not a method for the controller "' + controllerName + '"');

    // apply the action
    router[verb](url, controller[methodName]);
  });
};

exports.setupRoutes = function (router) {
  var controllerFilenames = {};
  exports.walkdir('controllers')
    .map(function (file) {
      controllerFilenames[path.basename(file)] = file;
    });
  Object.keys(config).reverse().map(function (key) {
    if (key.indexOf('routes') === 0) {
      exports.addRoutes(config[key], router, controllerFilenames, key.split('.')[1]);
    }
  });
};

exports.setupCronJobs = function () {
  // configure cronjobs
  console.log('Configuring cronjobs...');

  var CronJob = require('cron').CronJob;
  exports.walkdir('cronjobs').forEach(function (file) {
    var jobConfig = require('./' + file);

    console.log('Registering cronjob "' + jobConfig.name + '" with schedule "' + jobConfig.time + '"...');
    new CronJob({
      start: true,
      cronTime: jobConfig.time,
      onTick: function () {
        console.log('Running cronjob "' + jobConfig.name + '"');

        Q.when(jobConfig.run()).then(function () {
          console.log('Cronjob "' + jobConfig.name + '" completed successfully');
        }, function (err) {
          console.error('Cronjob "' + jobConfig.name + '" did not complete successfully');
          console.error('Cronjob error: ' + err);
        });
      }
    });
  });
};

exports.compareVersion = function (a, b) {
  var pa = a.split('.');
  var pb = b.split('.');
  for (var i = 0; i < 3; i++) {
    var na = Number(pa[i]);
    var nb = Number(pb[i]);
    if (na > nb) return 1;
    if (nb > na) return -1;
    if (!isNaN(na) && isNaN(nb)) return 1;
    if (isNaN(na) && !isNaN(nb)) return -1;
  }
  return 0;
};


exports.isAdmin = function (role) {
  return _.includes([USER_TYPES.ADMIN, USER_TYPES.SUPER_USER], role);
};

exports.isSuperUser = function (role) {
  return _.includes([USER_TYPES.SUPER_USER], role);
};

exports.isLeader = function (role) {
  return _.includes([USER_TYPES.ADMIN, USER_TYPES.SUPER_USER, USER_TYPES.LEADER], role);
};

exports.detectAbnormal = function (userId) {
  User.findByPk(userId).then(function (user) {
    if (user && user.login_count && (user.login_count > 100 || user.ip_count > 40 || user.view_count > 1500)) {
      return Abnormal.findOne({
        where: {
          user_id: userId
        }
      }).then(function (ab) {
        if (!ab) {
          return Abnormal.create({
            user_id: userId
          });
        }
      });
    }
  });
};


exports.getUserByToken = function (req) {
  const token = req.headers.token || req.query.token || req.headers['x-access-token'];
  return new Promise(function (resolve) {
    if (!token) {
      return resolve(null);
    }
    jwt.verify(token, secret.api_secret, function (err, decoded) {
      if (err) {
        return resolve(null);
      }

      User.findByPk(decoded.user.id).then(function (user) {
        if (!user) {
          return resolve(null);
        }
        return resolve(user);
      }).catch(function (error) {
        return resolve(null);
      });
    });
  });
};

exports.verifyToken = function (req) {
  return Promise.resolve()
    .then(function () {
      var token = req.headers.token || req.query.token || req.headers['x-access-token'];
      if (!token) {
        req.user = null;
        return null;
      }
      var deferred = Q.defer();
      jwt.verify(token, secret.api_secret, function (err, decoded) {
        if (err || !decoded || !decoded.user || !decoded.user.id) {
          req.user = null;
          return deferred.resolve(null);
        }
        return exports.deserializeUser(decoded.user.id)
          .then(function(user) {
            req.user = null;
            return deferred.resolve(user);
          });
      });
      return deferred.promise;
    });
};

exports.requestInfo = (req) => {
  var useragent = ua.lookup(req.headers['user-agent']);
  return `
    UserAgent: ${req.headers['user-agent']}
    RequestURL: ${req.url}
    ipaddress: ${req.ip}
    userID: ${req.user ? req.user.id : ''}
    OS: ${useragent ? useragent.os.toString() : ''}
  `
}

exports.cleanInvalidChar = function(text) {
  return text ? text.replace(/[^a-zA-Z0-9\_\-\(\)]/g,"") : '';
}
exports.slugify = function (txt) {
  return txt ? slugify(txt, {
    replacement: '-',
    lower: true,
  }) : ''
}

exports.objectToCSV = (obj, fields) => {
  var lines = [fields.join(',')];
  _.each(obj, function (row) {
    var cols = [];
    _.each(fields, function (field) {
      cols.push(`"${_.result(row, field, '')}"`);
    });
    lines.push(cols.join(','));
  });

  return lines.join('\n');
}

exports.joinURL = (arr) => {
  return arr.join('/');
}

exports.deserializeUser = function (id) {
  return User.findOne({
    where: { id: id }
  });
};
