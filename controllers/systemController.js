module.exports = {
  getStatus: async function (req, res, next) {
    res.send('running');
  },
  getCurrentUser: async function (req, res, next) {
    const users = await User.findAll()
    res.send(users);
  }
}