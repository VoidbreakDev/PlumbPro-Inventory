import express from 'express';
import { body } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import {
  syncProjectJobs,
  syncStageToJob,
  validateAllocatedItems,
  validateAssignedWorkers
} from '../services/jobPersistence.js';
import { checkWorkflowTriggers } from '../services/workflowEngine.js';

const router = express.Router();

router.use(authenticateToken, authorizeRole('admin', 'owner', 'manager'));

const DEVELOPMENT_STAGE_LIBRARY = [
  'Drain Underfloor',
  'Stormwater',
  'First Fix',
  'Chrome Off/Final Fix',
  'Bath Installs',
  'Hot Water Service Installs',
  'Rainwater Tanks',
  'Sump Tanks + Accessories'
];

const STAGE_STATUS_FROM_JOB = {
  Scheduled: 'scheduled',
  'In Progress': 'in_progress',
  Completed: 'completed',
  Cancelled: 'blocked'
};

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const normalizeHouseProfile = (houseProfile = {}) => ({
  storeys: Math.max(1, Number(houseProfile.storeys || 1)),
  bathroomCount: Math.max(1, Number(houseProfile.bathroomCount || 1)),
  kitchenConfig: houseProfile.kitchenConfig || 'standard',
  hasButlersPantry: Boolean(houseProfile.hasButlersPantry),
  customOptions: Array.isArray(houseProfile.customOptions)
    ? Array.from(new Set(houseProfile.customOptions.map((option) => String(option).trim()).filter(Boolean)))
    : []
});

const mapStageRow = (row) => ({
  id: row.id,
  projectId: row.project_id,
  stageType: row.stage_type,
  sortOrder: row.sort_order,
  status: row.status,
  plannedDate: row.planned_date,
  assignedWorkerIds: Array.isArray(row.assigned_worker_ids)
    ? row.assigned_worker_ids
    : row.assigned_worker_ids || [],
  linkedJobId: row.linked_job_id,
  linkedJobStatus: row.linked_job_status,
  baseKitId: row.base_kit_id,
  baseKitName: row.base_kit_name,
  variationId: row.variation_id,
  variationName: row.variation_name,
  modifierSnapshot: row.modifier_snapshot || undefined,
  resolvedAllocatedItems: Array.isArray(row.resolved_allocated_items)
    ? row.resolved_allocated_items
    : row.resolved_allocated_items || [],
  manualItemAdjustments: Array.isArray(row.manual_item_adjustments)
    ? row.manual_item_adjustments
    : row.manual_item_adjustments || [],
  isApplicable: row.is_applicable,
  notes: row.notes,
  completedAt: row.completed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapProjectRow = (row, stages = []) => ({
  id: row.id,
  title: row.title,
  builder: row.builder,
  customerId: row.customer_id,
  siteAddress: row.site_address,
  targetStartDate: row.target_start_date,
  targetCompletionDate: row.target_completion_date,
  notes: row.notes,
  houseProfile: normalizeHouseProfile(row.house_profile || {}),
  overallStatus: row.overall_status,
  stages,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const determineOverallStatus = (statuses) => {
  const actionableStatuses = statuses.filter((status) => status !== 'skipped');

  if (actionableStatuses.length === 0) {
    return 'Planning';
  }

  if (actionableStatuses.every((status) => status === 'completed')) {
    return 'Completed';
  }

  if (actionableStatuses.some((status) => status === 'blocked')) {
    return 'On Hold';
  }

  if (actionableStatuses.some((status) => ['scheduled', 'in_progress', 'completed'].includes(status))) {
    return 'Active';
  }

  return 'Planning';
};

const recalculateProjectOverallStatus = async (client, projectId) => {
  const result = await client.query(
    `
      SELECT status
      FROM development_stages
      WHERE project_id = $1
      ORDER BY sort_order ASC
    `,
    [projectId]
  );

  const nextStatus = determineOverallStatus(result.rows.map((row) => row.status));

  await client.query(
    `
      UPDATE development_projects
      SET overall_status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [projectId, nextStatus]
  );
};

const syncStageStatusesFromJobs = async (client, userId, projectId) => {
  const params = [userId];
  let projectClause = '';

  if (projectId) {
    params.push(projectId);
    projectClause = ' AND ds.project_id = $2';
  }

  const result = await client.query(
    `
      SELECT
        ds.id,
        ds.project_id,
        ds.status as stage_status,
        j.id as linked_job_id,
        j.status as linked_job_status
      FROM development_stages ds
      LEFT JOIN jobs j
        ON j.development_stage_id = ds.id
       AND j.user_id = ds.user_id
      WHERE ds.user_id = $1${projectClause}
    `,
    params
  );

  const touchedProjectIds = new Set();

  for (const row of result.rows) {
    let nextStatus = row.stage_status;

    if (row.linked_job_status && row.stage_status !== 'skipped') {
      nextStatus = STAGE_STATUS_FROM_JOB[row.linked_job_status] || row.stage_status;
    }

    if (nextStatus !== row.stage_status) {
      touchedProjectIds.add(row.project_id);
      await client.query(
        `
          UPDATE development_stages
          SET status = $2,
              completed_at = CASE WHEN $2 = 'completed' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE completed_at END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [row.id, nextStatus]
      );
    }
  }

  for (const touchedProjectId of touchedProjectIds) {
    await recalculateProjectOverallStatus(client, touchedProjectId);
  }
};

const loadProjects = async (client, userId, options = {}) => {
  await syncStageStatusesFromJobs(client, userId, options.projectId);

  const params = [userId];
  const conditions = ['dp.user_id = $1'];

  if (options.projectId) {
    params.push(options.projectId);
    conditions.push(`dp.id = $${params.length}`);
  }

  if (options.search) {
    params.push(`%${options.search}%`);
    conditions.push(
      `(dp.title ILIKE $${params.length} OR COALESCE(dp.builder, '') ILIKE $${params.length} OR COALESCE(dp.site_address, '') ILIKE $${params.length})`
    );
  }

  const limitClause = options.limit ? `LIMIT ${Number(options.limit)}` : '';
  const projectsResult = await client.query(
    `
      SELECT dp.*
      FROM development_projects dp
      WHERE ${conditions.join(' AND ')}
      ORDER BY COALESCE(dp.target_start_date, dp.created_at::date) DESC, dp.created_at DESC
      ${limitClause}
    `,
    params
  );

  if (projectsResult.rows.length === 0) {
    return [];
  }

  const projectIds = projectsResult.rows.map((row) => row.id);
  const stagesResult = await client.query(
    `
      SELECT
        ds.*,
        j.id as linked_job_id,
        j.status as linked_job_status
      FROM development_stages ds
      LEFT JOIN jobs j
        ON j.development_stage_id = ds.id
       AND j.user_id = ds.user_id
      WHERE ds.user_id = $1
        AND ds.project_id = ANY($2::uuid[])
      ORDER BY ds.sort_order ASC
    `,
    [userId, projectIds]
  );

  const stagesByProjectId = stagesResult.rows.reduce((groups, row) => {
    const projectStages = groups.get(row.project_id) || [];
    projectStages.push(mapStageRow(row));
    groups.set(row.project_id, projectStages);
    return groups;
  }, new Map());

  return projectsResult.rows.map((row) =>
    mapProjectRow(row, stagesByProjectId.get(row.id) || [])
  );
};

router.get('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const projects = await loadProjects(client, req.user.userId, {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined
    });

    res.json(projects);
  } catch (error) {
    console.error('Get development projects error:', error);
    res.status(500).json({ error: 'Failed to fetch development projects' });
  } finally {
    client.release();
  }
});

router.get('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const [project] = await loadProjects(client, req.user.userId, {
      projectId: req.params.id
    });

    if (!project) {
      return res.status(404).json({ error: 'Development project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Get development project error:', error);
    res.status(500).json({ error: 'Failed to fetch development project' });
  } finally {
    client.release();
  }
});

router.post(
  '/',
  [
    body('title').notEmpty().trim(),
    body('builder').optional({ nullable: true }).trim(),
    body('customerId').optional({ nullable: true }).isUUID(),
    body('siteAddress').optional({ nullable: true }).trim(),
    body('targetStartDate').optional({ nullable: true }).isISO8601(),
    body('targetCompletionDate').optional({ nullable: true }).isISO8601(),
    body('notes').optional({ nullable: true }).trim(),
    body('houseProfile').isObject(),
    body('skippedStageTypes').optional().isArray(),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const normalizedProfile = normalizeHouseProfile(req.body.houseProfile);
      const skippedStageTypes = Array.isArray(req.body.skippedStageTypes)
        ? req.body.skippedStageTypes.filter((stageType) => DEVELOPMENT_STAGE_LIBRARY.includes(stageType))
        : [];

      const projectResult = await client.query(
        `
          INSERT INTO development_projects (
            user_id,
            title,
            builder,
            customer_id,
            site_address,
            target_start_date,
            target_completion_date,
            notes,
            house_profile,
            overall_status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Planning')
          RETURNING id
        `,
        [
          req.user.userId,
          req.body.title.trim(),
          req.body.builder || null,
          req.body.customerId || null,
          req.body.siteAddress || null,
          req.body.targetStartDate || null,
          req.body.targetCompletionDate || null,
          req.body.notes || null,
          JSON.stringify(normalizedProfile)
        ]
      );

      const projectId = projectResult.rows[0].id;

      for (const [index, stageType] of DEVELOPMENT_STAGE_LIBRARY.entries()) {
        const isSkipped = skippedStageTypes.includes(stageType);
        await client.query(
          `
            INSERT INTO development_stages (
              user_id,
              project_id,
              stage_type,
              sort_order,
              status,
              assigned_worker_ids,
              modifier_snapshot,
              resolved_allocated_items,
              manual_item_adjustments,
              is_applicable
            )
            VALUES ($1, $2, $3, $4, $5, '[]', '{}'::jsonb, '[]', '[]', $6)
          `,
          [
            req.user.userId,
            projectId,
            stageType,
            index + 1,
            isSkipped ? 'skipped' : 'pending',
            !isSkipped
          ]
        );
      }

      await recalculateProjectOverallStatus(client, projectId);
      await client.query('COMMIT');

      const [project] = await loadProjects(client, req.user.userId, { projectId });
      res.status(201).json(project);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create development project error:', error);
      res.status(500).json({ error: 'Failed to create development project' });
    } finally {
      client.release();
    }
  }
);

router.put(
  '/:id',
  [
    body('title').optional().notEmpty().trim(),
    body('builder').optional({ nullable: true }).trim(),
    body('customerId').optional({ nullable: true }).isUUID(),
    body('siteAddress').optional({ nullable: true }).trim(),
    body('targetStartDate').optional({ nullable: true }).isISO8601(),
    body('targetCompletionDate').optional({ nullable: true }).isISO8601(),
    body('notes').optional({ nullable: true }).trim(),
    body('houseProfile').optional().isObject(),
    body('overallStatus')
      .optional()
      .isIn(['Planning', 'Active', 'Completed', 'On Hold', 'Cancelled']),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const updates = [];
      const values = [];
      let paramCount = 1;
      const currentProjectResult = await client.query(
        'SELECT * FROM development_projects WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.userId]
      );

      if (currentProjectResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Development project not found' });
      }

      const fieldMap = {
        title: 'title',
        builder: 'builder',
        customerId: 'customer_id',
        siteAddress: 'site_address',
        targetStartDate: 'target_start_date',
        targetCompletionDate: 'target_completion_date',
        notes: 'notes',
        overallStatus: 'overall_status'
      };

      Object.entries(fieldMap).forEach(([inputKey, column]) => {
        if (hasOwn(req.body, inputKey)) {
          updates.push(`${column} = $${paramCount}`);
          values.push(req.body[inputKey] ?? null);
          paramCount += 1;
        }
      });

      if (hasOwn(req.body, 'houseProfile')) {
        updates.push(`house_profile = $${paramCount}`);
        values.push(JSON.stringify(normalizeHouseProfile(req.body.houseProfile)));
        paramCount += 1;
      }

      if (updates.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      values.push(req.params.id);
      values.push(req.user.userId);

      await client.query(
        `
          UPDATE development_projects
          SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
        `,
        values
      );

      const [project] = await loadProjects(client, req.user.userId, {
        projectId: req.params.id
      });

      await syncProjectJobs(client, req.user.userId, project, project.stages);

      if (!hasOwn(req.body, 'overallStatus')) {
        await recalculateProjectOverallStatus(client, req.params.id);
      }

      await client.query('COMMIT');

      const [updatedProject] = await loadProjects(client, req.user.userId, {
        projectId: req.params.id
      });
      res.json(updatedProject);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Update development project error:', error);
      res.status(500).json({ error: 'Failed to update development project' });
    } finally {
      client.release();
    }
  }
);

router.put(
  '/:projectId/stages/:stageId',
  [
    body('status')
      .optional()
      .isIn(['pending', 'scheduled', 'in_progress', 'completed', 'skipped', 'blocked']),
    body('plannedDate').optional({ nullable: true }).isISO8601(),
    body('assignedWorkerIds').optional().isArray(),
    body('assignedWorkerIds.*').optional().isUUID(),
    body('baseKitId').optional({ nullable: true }).isString(),
    body('baseKitName').optional({ nullable: true }).isString(),
    body('variationId').optional({ nullable: true }).isString(),
    body('variationName').optional({ nullable: true }).isString(),
    body('modifierSnapshot').optional().isObject(),
    body('resolvedAllocatedItems').optional().isArray(),
    body('resolvedAllocatedItems.*.itemId').optional().isUUID(),
    body('resolvedAllocatedItems.*.quantity').optional().isInt({ min: 0 }),
    body('manualItemAdjustments').optional().isArray(),
    body('manualItemAdjustments.*.itemId').optional().isUUID(),
    body('manualItemAdjustments.*.quantity').optional().isInt({ min: 0 }),
    body('isApplicable').optional().isBoolean(),
    body('notes').optional({ nullable: true }).isString(),
    validate
  ],
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const [project] = await loadProjects(client, req.user.userId, {
        projectId: req.params.projectId
      });

      if (!project) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Development project not found' });
      }

      const currentStage = project.stages.find((stage) => stage.id === req.params.stageId);

      if (!currentStage) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Development stage not found' });
      }

      if (hasOwn(req.body, 'assignedWorkerIds')) {
        await validateAssignedWorkers(client, req.user.userId, req.body.assignedWorkerIds || []);
      }

      if (hasOwn(req.body, 'resolvedAllocatedItems')) {
        await validateAllocatedItems(client, req.user.userId, req.body.resolvedAllocatedItems || []);
      }

      const mergedStage = {
        ...currentStage,
        ...req.body,
        assignedWorkerIds: hasOwn(req.body, 'assignedWorkerIds')
          ? req.body.assignedWorkerIds || []
          : currentStage.assignedWorkerIds,
        resolvedAllocatedItems: hasOwn(req.body, 'resolvedAllocatedItems')
          ? req.body.resolvedAllocatedItems || []
          : currentStage.resolvedAllocatedItems,
        manualItemAdjustments: hasOwn(req.body, 'manualItemAdjustments')
          ? req.body.manualItemAdjustments || []
          : currentStage.manualItemAdjustments || [],
        isApplicable:
          req.body.status === 'skipped'
            ? false
            : hasOwn(req.body, 'isApplicable')
              ? req.body.isApplicable
              : currentStage.isApplicable
      };

      if (
        ['scheduled', 'in_progress', 'completed'].includes(mergedStage.status) &&
        !mergedStage.plannedDate
      ) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Planned date is required for scheduled or active stages'
        });
      }

      const updates = [];
      const values = [];
      let paramCount = 1;
      const fieldMap = {
        status: 'status',
        plannedDate: 'planned_date',
        baseKitId: 'base_kit_id',
        baseKitName: 'base_kit_name',
        variationId: 'variation_id',
        variationName: 'variation_name',
        isApplicable: 'is_applicable',
        notes: 'notes'
      };

      Object.entries(fieldMap).forEach(([inputKey, column]) => {
        if (hasOwn(mergedStage, inputKey)) {
          updates.push(`${column} = $${paramCount}`);
          values.push(mergedStage[inputKey] ?? null);
          paramCount += 1;
        }
      });

      if (hasOwn(mergedStage, 'assignedWorkerIds')) {
        updates.push(`assigned_worker_ids = $${paramCount}`);
        values.push(JSON.stringify(mergedStage.assignedWorkerIds || []));
        paramCount += 1;
      }

      if (hasOwn(mergedStage, 'modifierSnapshot')) {
        updates.push(`modifier_snapshot = $${paramCount}`);
        values.push(JSON.stringify(mergedStage.modifierSnapshot || {}));
        paramCount += 1;
      }

      if (hasOwn(mergedStage, 'resolvedAllocatedItems')) {
        updates.push(`resolved_allocated_items = $${paramCount}`);
        values.push(JSON.stringify(mergedStage.resolvedAllocatedItems || []));
        paramCount += 1;
      }

      if (hasOwn(mergedStage, 'manualItemAdjustments')) {
        updates.push(`manual_item_adjustments = $${paramCount}`);
        values.push(JSON.stringify(mergedStage.manualItemAdjustments || []));
        paramCount += 1;
      }

      updates.push(`completed_at = CASE WHEN $${paramCount} = 'completed' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) WHEN $${paramCount} <> 'completed' THEN NULL ELSE completed_at END`);
      values.push(mergedStage.status);
      paramCount += 1;

      values.push(req.params.stageId);
      values.push(req.user.userId);

      await client.query(
        `
          UPDATE development_stages
          SET ${updates.join(', ')},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
        `,
        values
      );

      const [updatedProjectBeforeJobSync] = await loadProjects(client, req.user.userId, {
        projectId: req.params.projectId
      });
      const updatedStage = updatedProjectBeforeJobSync.stages.find((stage) => stage.id === req.params.stageId);
      const linkedJob = await syncStageToJob(client, req.user.userId, updatedProjectBeforeJobSync, updatedStage);

      await recalculateProjectOverallStatus(client, req.params.projectId);
      await client.query('COMMIT');

      const [updatedProject] = await loadProjects(client, req.user.userId, {
        projectId: req.params.projectId
      });

      void checkWorkflowTriggers(
        'project_stage',
        {
          projectId: updatedProject.id,
          stageId: updatedStage.id,
          stageType: updatedStage.stageType,
          status: updatedStage.status,
          plannedDate: updatedStage.plannedDate,
          linkedJobId: linkedJob?.id
        },
        req.user.userId
      ).catch((error) => {
        console.error('Project stage workflow trigger error:', error);
      });

      res.json(updatedProject);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Update development stage error:', error);
      res.status(500).json({ error: 'Failed to update development stage' });
    } finally {
      client.release();
    }
  }
);

router.delete('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
        UPDATE jobs
        SET development_project_id = NULL,
            development_stage_id = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND development_project_id = $2
      `,
      [req.user.userId, req.params.id]
    );

    const result = await client.query(
      `
        DELETE FROM development_projects
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `,
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Development project not found' });
    }

    await client.query('COMMIT');
    res.json({ message: 'Development project deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete development project error:', error);
    res.status(500).json({ error: 'Failed to delete development project' });
  } finally {
    client.release();
  }
});

export default router;
