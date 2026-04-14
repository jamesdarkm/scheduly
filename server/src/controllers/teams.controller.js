const teamService = require('../services/team.service');

async function list(req, res, next) {
  try {
    const teams = await teamService.listTeams();
    res.json(teams);
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    const team = await teamService.getTeam(parseInt(req.params.id, 10));
    res.json(team);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Team name is required' });
    const team = await teamService.createTeam({ name, description, createdBy: req.user.userId });
    res.status(201).json(team);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const team = await teamService.updateTeam(parseInt(req.params.id, 10), req.body);
    res.json(team);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await teamService.deleteTeam(parseInt(req.params.id, 10));
    res.json({ message: 'Team deleted' });
  } catch (err) { next(err); }
}

async function addMember(req, res, next) {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const team = await teamService.addMember(parseInt(req.params.id, 10), userId);
    res.json(team);
  } catch (err) { next(err); }
}

async function removeMember(req, res, next) {
  try {
    const team = await teamService.removeMember(
      parseInt(req.params.id, 10),
      parseInt(req.params.userId, 10)
    );
    res.json(team);
  } catch (err) { next(err); }
}

module.exports = { list, get, create, update, remove, addMember, removeMember };
