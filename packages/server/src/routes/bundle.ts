import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  generateBundle, validateBundle, diffBundle, applyBundle,
} from '../app-bundle';
import type { BundleManifest, ApplyOptions } from '../app-bundle';

const router = Router();

// ── GET /api/app/export ───────────────────────────────────────────────────────
// Generate and download the full application bundle as .zenku.json

router.get('/app/export', requireAuth, async (req, res) => {
  const manifest: BundleManifest = {
    name: String(req.query.name || 'Zenku App'),
    description: String(req.query.description || ''),
    version: String(req.query.version || '1.0.0'),
    author: String(req.query.author || ''),
  };

  const bundle = await generateBundle(manifest);
  const filename = `${manifest.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.zenku.json`;

  res
    .setHeader('Content-Type', 'application/json')
    .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    .json(bundle);
});

// ── POST /api/app/import/preview ─────────────────────────────────────────────
// Dry-run: parse bundle and return diff without writing anything

router.post('/app/import/preview', requireAuth, async (req, res) => {
  const result = validateBundle(req.body);
  if (!result.valid) {
    res.status(400).json({ error: result.error });
    return;
  }

  const diff = await diffBundle(result.bundle);
  res.json({
    manifest: result.bundle.manifest,
    diff,
    summary: {
      tables: diff.tables_to_create.length + diff.tables_to_alter.length,
      views:  diff.views_to_create.length + diff.views_to_update.length,
      rules:  diff.rules_to_create.length + diff.rules_to_update.length,
      webhooks: diff.webhook_urls.length,
    },
  });
});

// ── POST /api/app/import/apply ────────────────────────────────────────────────
// Apply the bundle to the database

router.post('/app/import/apply', requireAuth, async (req, res) => {
  const { bundle: bundleData, options = {} } = req.body as {
    bundle: unknown;
    options?: ApplyOptions & { webhook_overrides?: Record<string, string> };
  };

  const result = validateBundle(bundleData);
  if (!result.valid) {
    res.status(400).json({ error: result.error });
    return;
  }

  const applyResult = await applyBundle(result.bundle, {
    disable_webhooks: options.disable_webhooks !== false, // default true
    webhook_overrides: options.webhook_overrides ?? {},
  });

  res.json({
    success: applyResult.errors.length === 0,
    ...applyResult,
  });
});

export default router;
