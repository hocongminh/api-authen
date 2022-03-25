
// Rails resourceful routes conventions:
//
// METHOD  PATH               ACTION   DESCRIPTION
// ------  ----               ------   -----------
// GET     /photos            index    Display a list of all photos
// GET     /photos/new        new      Return HTML form for creating a new photo
// POST    /photos            create   Create a new photo
// GET     /photos/:id        show     Display a specific photo
// GET     /photos/:id/edit   edit     Return an HTML form for editing a photo
// PATCH   /photos/:id        update   Update a specific photo
// DELETE  /photos/:id        destroy  Delete a specific photo
//
// For a web service, we're only interested in these actions:
// index, create, show, update, destroy

module.exports = {
  'get /api/is-running':             'systemController.getStatus',
};
