const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');

const listVariablePaths = fs.readdirSync(__dirname)
    .filter(function(file) {
        return (file.indexOf('.') !== 0) && (file !== 'index.js');
    });
const globalVariables = {};
listVariablePaths.map(function (file) {
    var variable = require(path.join(__dirname, file));
    if (variable.name && variable.getter) {
        globalVariables[variable.name] = variable;
    }
})
module.exports = {
    init: function () {
        return this.load();
    },
    load : function () {
        console.log('Loading global...');
        return Promise.map(Object.keys(globalVariables), function (name) {
            return globalVariables[name].getter()
                .then(function (data) {
                    global[name] = data
                    console.log('Variable "' + name + '" loaded.');
                })
        })
    }
}
