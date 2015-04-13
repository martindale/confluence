var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId
  , mongooseRedisCache = require('mongoose-redis-cache')
  , slug = require('mongoose-slug')
  , textSearch = require('mongoose-text-search')
  , async = require('async')
  , url = require('url');

var ResourceSchema = new Schema({
    id: { type: String }
  , provider: { type: String }
  , uri: { type: String, required: true }
  , updated: { type: Date }
  , data: {}
});
ResourceSchema.pre('save', function(next) {
  // TODO: remove protocol from resources
  /* var self = this;
  var obj = url.parse( self.uri );
  this.uri = obj.host + obj.path; */

  next();
});
// this defines the fields associated with the model,
// and moreover, their type.
var PostSchema = new Schema({
    _author:    { type: ObjectId, ref: 'Person'/*, required: true */ }
  , _parent:    { type: ObjectId, ref: 'Post' }
  , created:    { type: Date, default: Date.now }
  , published:  { type: Date, default: Date.now }
  , updated:    { type: Date }
  , title:      { type: String }
  , content:    { type: String }
  , contents:   [ { type: String } ]
  , markup:     { type: String, enum: ['html', 'markdown'] }
  , visibility: { type: String, enum: ['owner', 'public'] }
  , featured:   { type: Boolean, default: false }
  , tags:       [ { type: String } ]
  , resources:  [ ResourceSchema ]
  , attachments: [ new Schema({
        url: { type: String }
      , title: { type: String }
      , description: { type: String }
      , type: { type: String, enum: ['video', 'image'] }
      , image: {
          url: { type: String }
        }
    }) ]
  , replies: [ new Schema({
        _author: { type: ObjectId, ref: 'Person' }
      , _post: { type: ObjectId, ref: 'Post' }
      , published: { type: Date }
      , updated: { type: Date }
    })]
});

PostSchema.virtual('isoDate').get(function() {
  return this.created.toISOString();
});
PostSchema.virtual('permalink').get(function() {
  return '/'+this.published.getFullYear()+'/'+(this.published.getMonth()+1)+'/'+this.published.getDate()+'/'+this.slug;
});

PostSchema.pre('save', function(next) {
  if (this.content && this.contents.indexOf( this.content ) == -1) {
    this.contents.push( this.content );
  }
  next();
});

PostSchema.statics.paginate = function( query, opts, cb ) {
  var self = this;

  opts.populate = opts.populate || '';

  async.parallel([
    function(done) {
      done(null, opts);
    },
    function(done) {
      Post.find( query ).sort('-published').skip( opts.skip ).populate( opts.populate ).limit( opts.limit ).exec( done );
    },
    function(done) {
      Post.count( query ).exec( done );
    }
  ], cb );

  return self;
}

PostSchema.plugin( slug('title', {
    track: true
  , override: true
}) );
PostSchema.plugin( textSearch );
PostSchema.index({ content: 'text' });
PostSchema.index({ slug: 1 });

PostSchema.set('redisCache', true);

var Post = mongoose.model('Post', PostSchema);

// export the model to anything requiring it.
module.exports = {
  Post: Post
};
