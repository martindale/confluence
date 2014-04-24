$(document).on('click', '*[data-action=merge-posts]', function(e) {
  e.preventDefault();
  var self = this;
  $.ajax('/admin/posts/merge', {
      type: 'POST'
    , dataType: 'json'
    , data: {
        postIDs: $(self).data('post-list')
      }
    , success: function(data) {
        console.log(data);
      }
  });

  return false;
});