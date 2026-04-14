const commentService = require('../services/comment.service');

async function list(req, res, next) {
  try {
    const postId = parseInt(req.query.postId, 10);
    if (!postId) return res.status(400).json({ error: 'postId is required' });
    const comments = await commentService.listComments(postId);
    res.json(comments);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { postId, body } = req.body;
    if (!postId || !body) return res.status(400).json({ error: 'postId and body are required' });
    const comment = await commentService.addComment(postId, req.user.userId, body);
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { body } = req.body;
    if (!body) return res.status(400).json({ error: 'body is required' });
    const comment = await commentService.updateComment(parseInt(req.params.id, 10), req.user.userId, body);
    res.json(comment);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await commentService.deleteComment(parseInt(req.params.id, 10), req.user.userId, req.user.role);
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
