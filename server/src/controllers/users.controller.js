const userService = require('../services/user.service');

async function list(req, res, next) {
  try {
    const users = await userService.listUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
}

async function get(req, res, next) {
  try {
    const user = await userService.getUser(parseInt(req.params.id, 10));
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, password, firstName, and lastName are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const user = await userService.createUser({ email, password, firstName, lastName, role });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const user = await userService.updateUser(parseInt(req.params.id, 10), req.body);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    await userService.deactivateUser(parseInt(req.params.id, 10));
    res.json({ message: 'User deactivated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, get, create, update, deactivate };
