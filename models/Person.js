var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId
  , passportLocalMongoose = require('passport-local-mongoose')
  , slug = require('../lib/mongoose-slug');

// this defines the fields associated with the model,
// and moreover, their type.
var PersonSchema = new Schema({
    emails: [ { type: String } ]
  , profiles: {
        google: [ new Schema({
          id: { type: String }
        }) ]
      , twitter: [ new Schema({
            id: { type: String }
          , username: { type: String }
          , name: { type: String }
        }) ]
      , facebook: [ new Schema({
          id: { type: String }
        }) ]
    }
});

PersonSchema.plugin(passportLocalMongoose);

PersonSchema.virtual('isoDate').get(function() {
  return this.created.toISOString();
});

PersonSchema.plugin( slug('username') , {
  override: true
} );
PersonSchema.index({ slug: 1 });

var Person = mongoose.model('Person', PersonSchema);

// export the model to anything requiring it.
module.exports = {
  Person: Person
};
