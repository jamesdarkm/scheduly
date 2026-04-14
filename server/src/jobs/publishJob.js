const pool = require('../config/db');
const { publishPost } = require('../services/publisher.service');
const logger = require('../utils/logger');

async function runPublishJob() {
  const connection = await pool.getConnection();

  try {
    // Find posts due for publishing
    const [duePosts] = await connection.execute(
      `SELECT id FROM posts
       WHERE status = 'scheduled' AND scheduled_at <= NOW()
       ORDER BY scheduled_at ASC
       LIMIT 10`
    );

    if (duePosts.length === 0) return;

    logger.info(`Publish job: found ${duePosts.length} post(s) due for publishing`);

    for (const { id } of duePosts) {
      try {
        // Set status to publishing
        const [updated] = await connection.execute(
          "UPDATE posts SET status = 'publishing' WHERE id = ? AND status = 'scheduled'",
          [id]
        );

        if (updated.affectedRows === 0) {
          // Another process already picked this up
          continue;
        }

        // Check if there are any social targets
        const [targets] = await connection.execute(
          "SELECT COUNT(*) as cnt FROM post_targets WHERE post_id = ? AND status = 'pending'",
          [id]
        );

        if (targets[0].cnt === 0) {
          // No social targets — mark as published directly (local-only post)
          await connection.execute(
            "UPDATE posts SET status = 'published', published_at = NOW() WHERE id = ?",
            [id]
          );
          logger.info(`Post ${id}: published (no social targets)`);

          await connection.execute(
            "INSERT INTO activity_log (user_id, action, entity_type, entity_id, details) VALUES (NULL, 'post.published', 'post', ?, ?)",
            [id, JSON.stringify({ method: 'scheduled', targets: 0 })]
          );
          continue;
        }

        // Publish to social platforms
        const { allSuccess, results } = await publishPost(id);

        if (allSuccess) {
          await connection.execute(
            "UPDATE posts SET status = 'published', published_at = NOW() WHERE id = ?",
            [id]
          );
          logger.info(`Post ${id}: all ${results.length} target(s) published successfully`);
        } else {
          const failedCount = results.filter(r => !r.success).length;
          const errorMsg = `${failedCount} of ${results.length} target(s) failed`;
          await connection.execute(
            "UPDATE posts SET status = 'failed', publish_error = ? WHERE id = ?",
            [errorMsg, id]
          );
          logger.warn(`Post ${id}: ${errorMsg}`);
        }

        await connection.execute(
          "INSERT INTO activity_log (user_id, action, entity_type, entity_id, details) VALUES (NULL, ?, 'post', ?, ?)",
          [
            allSuccess ? 'post.published' : 'post.publish_failed',
            id,
            JSON.stringify({ targets: results.length, results: results.map(r => ({ platform: r.platform, success: r.success })) }),
          ]
        );
      } catch (postErr) {
        logger.error(`Publish job: error processing post ${id}`, { error: postErr.message });
        await connection.execute(
          "UPDATE posts SET status = 'failed', publish_error = ? WHERE id = ?",
          [postErr.message, id]
        ).catch(() => {});
      }
    }
  } catch (err) {
    logger.error('Publish job: fatal error', { error: err.message });
  } finally {
    connection.release();
  }
}

module.exports = { runPublishJob };
