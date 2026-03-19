import pool from '../config/database.js';

const JOB_STATUS_FROM_STAGE = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  skipped: 'Cancelled',
  blocked: 'Cancelled',
  pending: 'Cancelled'
};

const JOB_SCALAR_FIELDS = {
  title: 'title',
  builder: 'builder',
  customerId: 'customer_id',
  jobType: 'job_type',
  status: 'status',
  date: 'date',
  jobAddress: 'job_address',
  developmentProjectId: 'development_project_id',
  developmentStageId: 'development_stage_id'
};

const JOB_SELECT_BASE = `
  SELECT
    j.*,
    ds.stage_type as development_stage_type,
    COALESCE(
      json_agg(
        DISTINCT jsonb_build_object('workerId', jw.worker_id, 'workerName', c.name)
      ) FILTER (WHERE jw.worker_id IS NOT NULL),
      '[]'
    ) as workers,
    COALESCE(
      json_agg(
        DISTINCT jsonb_build_object('itemId', jai.item_id, 'quantity', jai.quantity, 'itemName', i.name)
      ) FILTER (WHERE jai.item_id IS NOT NULL),
      '[]'
    ) as allocated_items
  FROM jobs j
  LEFT JOIN development_stages ds ON j.development_stage_id = ds.id
  LEFT JOIN job_workers jw ON j.id = jw.job_id
  LEFT JOIN contacts c ON jw.worker_id = c.id AND c.user_id = $1
  LEFT JOIN job_allocated_items jai ON j.id = jai.job_id
  LEFT JOIN inventory_items i ON jai.item_id = i.id AND i.user_id = $1
`;

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export const mapJobRow = (row) => ({
  id: row.id,
  title: row.title,
  builder: row.builder,
  customerId: row.customer_id,
  jobType: row.job_type,
  status: row.status,
  date: row.date,
  isPicked: row.is_picked,
  jobAddress: row.job_address,
  developmentProjectId: row.development_project_id,
  developmentStageId: row.development_stage_id,
  developmentStageType: row.development_stage_type,
  assignedWorkerIds: (row.workers || []).map((worker) => worker.workerId).filter(Boolean),
  workers: row.workers || [],
  allocatedItems: (row.allocated_items || []).map((item) => ({
    itemId: item.itemId,
    quantity: item.quantity,
    itemName: item.itemName
  }))
});

export async function getJobById(client, userId, jobId) {
  const result = await client.query(
    `
      ${JOB_SELECT_BASE}
      WHERE j.user_id = $1 AND j.id = $2
      GROUP BY j.id, ds.stage_type
    `,
    [userId, jobId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapJobRow(result.rows[0]);
}

export async function listJobs(client, userId, options = {}) {
  const params = [userId];
  const conditions = ['j.user_id = $1'];

  if (options.search) {
    params.push(`%${options.search}%`);
    conditions.push(
      `(j.title ILIKE $${params.length} OR COALESCE(j.builder, '') ILIKE $${params.length} OR COALESCE(j.job_type, '') ILIKE $${params.length} OR COALESCE(j.job_address, '') ILIKE $${params.length})`
    );
  }

  const limitClause = options.limit ? `LIMIT ${Number(options.limit)}` : '';
  const result = await client.query(
    `
      ${JOB_SELECT_BASE}
      WHERE ${conditions.join(' AND ')}
      GROUP BY j.id, ds.stage_type
      ORDER BY j.date DESC, j.created_at DESC
      ${limitClause}
    `,
    params
  );

  return result.rows.map(mapJobRow);
}

export async function validateAssignedWorkers(client, userId, assignedWorkerIds = []) {
  if (!assignedWorkerIds || assignedWorkerIds.length === 0) {
    return;
  }

  const workerCheck = await client.query(
    `
      SELECT id
      FROM contacts
      WHERE id = ANY($1) AND user_id = $2 AND type = 'Plumber'
    `,
    [assignedWorkerIds, userId]
  );

  if (workerCheck.rows.length !== assignedWorkerIds.length) {
    const foundIds = workerCheck.rows.map((row) => row.id);
    const invalidIds = assignedWorkerIds.filter((id) => !foundIds.includes(id));
    const error = new Error('Invalid worker IDs');
    error.statusCode = 400;
    error.details = {
      invalidIds,
      message: 'All workers must be valid contacts of type Plumber'
    };
    throw error;
  }
}

export async function validateAllocatedItems(client, userId, allocatedItems = []) {
  if (!allocatedItems || allocatedItems.length === 0) {
    return;
  }

  const itemIds = allocatedItems.map((item) => item.itemId);
  const itemCheck = await client.query(
    `
      SELECT id
      FROM inventory_items
      WHERE id = ANY($1) AND user_id = $2
    `,
    [itemIds, userId]
  );

  if (itemCheck.rows.length !== itemIds.length) {
    const foundIds = itemCheck.rows.map((row) => row.id);
    const invalidIds = itemIds.filter((id) => !foundIds.includes(id));
    const error = new Error('Invalid item IDs');
    error.statusCode = 400;
    error.details = {
      invalidIds,
      message: 'All allocated items must be valid inventory items'
    };
    throw error;
  }
}

export async function replaceJobWorkers(client, jobId, assignedWorkerIds = []) {
  await client.query('DELETE FROM job_workers WHERE job_id = $1', [jobId]);

  for (const workerId of assignedWorkerIds) {
    await client.query(
      'INSERT INTO job_workers (job_id, worker_id) VALUES ($1, $2)',
      [jobId, workerId]
    );
  }
}

export async function replaceJobAllocatedItems(client, jobId, allocatedItems = []) {
  await client.query('DELETE FROM job_allocated_items WHERE job_id = $1', [jobId]);

  for (const item of allocatedItems) {
    await client.query(
      'INSERT INTO job_allocated_items (job_id, item_id, quantity) VALUES ($1, $2, $3)',
      [jobId, item.itemId, item.quantity]
    );
  }
}

export async function syncJobRelations(client, userId, jobId, relations = {}) {
  if (hasOwn(relations, 'assignedWorkerIds')) {
    await validateAssignedWorkers(client, userId, relations.assignedWorkerIds || []);
    await replaceJobWorkers(client, jobId, relations.assignedWorkerIds || []);
  }

  if (hasOwn(relations, 'allocatedItems')) {
    await validateAllocatedItems(client, userId, relations.allocatedItems || []);
    await replaceJobAllocatedItems(client, jobId, relations.allocatedItems || []);
  }
}

export async function createJobWithRelations(client, userId, data) {
  const result = await client.query(
    `
      INSERT INTO jobs (
        user_id,
        title,
        builder,
        customer_id,
        job_type,
        status,
        date,
        is_picked,
        job_address,
        development_project_id,
        development_stage_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `,
    [
      userId,
      data.title,
      data.builder || null,
      data.customerId || null,
      data.jobType,
      data.status || 'Scheduled',
      data.date,
      data.isPicked || false,
      data.jobAddress || null,
      data.developmentProjectId || null,
      data.developmentStageId || null
    ]
  );

  const jobId = result.rows[0].id;
  await syncJobRelations(client, userId, jobId, data);
  return getJobById(client, userId, jobId);
}

export async function updateJobWithRelations(client, userId, jobId, updates = {}) {
  const scalarUpdates = [];
  const scalarValues = [];
  let paramCount = 1;

  Object.keys(JOB_SCALAR_FIELDS).forEach((key) => {
    if (hasOwn(updates, key)) {
      scalarUpdates.push(`${JOB_SCALAR_FIELDS[key]} = $${paramCount}`);
      scalarValues.push(updates[key] ?? null);
      paramCount += 1;
    }
  });

  if (scalarUpdates.length > 0) {
    scalarValues.push(jobId);
    scalarValues.push(userId);

    const result = await client.query(
      `
        UPDATE jobs
        SET ${scalarUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
        RETURNING id
      `,
      scalarValues
    );

    if (result.rows.length === 0) {
      return null;
    }
  } else {
    const existing = await client.query(
      'SELECT id FROM jobs WHERE id = $1 AND user_id = $2',
      [jobId, userId]
    );

    if (existing.rows.length === 0) {
      return null;
    }
  }

  await syncJobRelations(client, userId, jobId, updates);
  return getJobById(client, userId, jobId);
}

const mapStageStatusToJobStatus = (stageStatus) =>
  JOB_STATUS_FROM_STAGE[stageStatus] || 'Scheduled';

const shouldCreateOperationalJob = (stage) =>
  ['scheduled', 'in_progress', 'completed'].includes(stage.status) && Boolean(stage.plannedDate);

export async function syncStageToJob(client, userId, project, stage) {
  const existingJobResult = await client.query(
    `
      SELECT id
      FROM jobs
      WHERE user_id = $1 AND development_stage_id = $2
      LIMIT 1
    `,
    [userId, stage.id]
  );

  const existingJobId = existingJobResult.rows[0]?.id;
  const jobPayload = {
    title: `${project.title} - ${stage.stageType}`,
    builder: project.builder || null,
    customerId: project.customerId || null,
    jobType: stage.stageType,
    status: mapStageStatusToJobStatus(stage.status),
    date: stage.plannedDate || project.targetStartDate,
    jobAddress: project.siteAddress || null,
    developmentProjectId: project.id,
    developmentStageId: stage.id,
    assignedWorkerIds: stage.assignedWorkerIds || [],
    allocatedItems: stage.resolvedAllocatedItems || []
  };

  if (shouldCreateOperationalJob(stage)) {
    if (existingJobId) {
      return updateJobWithRelations(client, userId, existingJobId, jobPayload);
    }

    return createJobWithRelations(client, userId, {
      ...jobPayload,
      isPicked: false
    });
  }

  if (!existingJobId) {
    return null;
  }

  return updateJobWithRelations(client, userId, existingJobId, {
    ...jobPayload,
    status: 'Cancelled'
  });
}

export async function syncProjectJobs(client, userId, project, stages) {
  for (const stage of stages) {
    await syncStageToJob(client, userId, project, stage);
  }
}

export async function getDatabaseClient() {
  return pool.connect();
}
