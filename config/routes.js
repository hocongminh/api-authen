
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
  'get /api/is-running': 'systemController.getStatus',
  'get /api/is-running-auth': ['admin', 'systemController.getCurrentUser'],

  //check auth
  'get /api/auth': 'AuthController.index',

  // Logout
  'delete /api/auth/logout': 'AuthController.destroy',

  // Login
  'post /api/auth/local': 'AuthController.authLocal',
  //Signup by email
  'post /api/auth/signup': 'UserController.apiSignup',
  
  // Google authentication
  'get /api/auth/google/signup': 'AuthController.authGoogleSignup',
  'get /api/auth/google/callback': 'AuthController.authGoogleCallback',
  'get /api/auth/google/success': 'AuthController.authGoogleSuccess',
  'get /api/auth/google/failure': 'AuthController.authGoogleFailure',

  // Login with google account
  'get /api/auth/google': 'AuthController.authGoogle'
};
