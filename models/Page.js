var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId
  , mongooseRedisCache = require('mongoose-redis-cache')
  , slug = require('../lib/mongoose-slug');

// this defines the fields associated with the model,
// and moreover, their type.
var PageSchema = new Schema({
    created: { type: Date, default: Date.now }
  , published: { type: Date, default: Date.now }
  , updated: { type: Date }
  , title:   { type: String }
  , content: { type: String }
  , markup:  { type: String }
});

PageSchema.virtual('isoDate').get(function() {
  return this.created.toISOString();
});

PageSchema.plugin( slug('title') );
PageSchema.index({ slug: 1 });

PageSchema.set('redisCache', true);

var Page = mongoose.model('Page', PageSchema);

// export the model to anything requiring it.
module.exports = {
  Page: Page
};
