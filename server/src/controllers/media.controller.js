const mediaService = require('../services/media.service');

async function upload(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    for (const file of req.files) {
      const media = await mediaService.processUpload(file, req.user.userId, req.body.teamId);
      results.push(media);
    }

    res.status(201).json(results);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { page, limit, type, uploadedBy, teamId } = req.query;
    const result = await mediaService.listMedia({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 24,
      type,
      uploadedBy: uploadedBy ? parseInt(uploadedBy, 10) : undefined,
      teamId: teamId ? parseInt(teamId, 10) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function get(req, res, next) {
  try {
    const media = await mediaService.getMedia(parseInt(req.params.id, 10));
    res.json(media);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await mediaService.deleteMedia(parseInt(req.params.id, 10), req.user.userId, req.user.role);
    res.json({ message: 'Media deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, list, get, remove };
