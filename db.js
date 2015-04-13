var config = require('./config')

var mongoose = require('mongoose');
var source = mongoose.connect(config.database.host, config.database.name);

module.exports = {
  mongoose: mongoose,
  source: source
}
