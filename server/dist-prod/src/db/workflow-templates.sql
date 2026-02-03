-- Pre-built Workflow Templates for Common Scenarios
-- These templates can be used to quickly create common workflows

-- Template 1: Low Stock Alert & Auto-Order
INSERT INTO workflow_templates (name, description, category, trigger_type, trigger_config, actions) VALUES
(
  'Low Stock Alert & Auto-Order',
  'Automatically notify and create purchase order when stock falls below reorder level',
  'inventory',
  'stock_level',
  '{"condition": "below_reorder"}'::jsonb,
  '[
    {
      "action_type": "send_notification",
      "action_config": {
        "title": "Low Stock Alert",
        "message": "{{itemName}} is running low ({{quantity}} remaining, reorder at {{reorderLevel}})",
        "type": "warning",
        "priority": "high"
      },
      "retry_on_failure": true,
      "max_retries": 3
    },
    {
      "action_type": "create_purchase_order",
      "action_config": {
        "itemId": "{{itemId}}",
        "quantity": "{{recommendedOrderQty}}",
        "supplier": "{{supplier}}",
        "notes": "Auto-generated from low stock workflow"
      },
      "retry_on_failure": true,
      "max_retries": 3
    },
    {
      "action_type": "send_email",
      "action_config": {
        "subject": "Purchase Order Required: {{itemName}}",
        "body": "A purchase order has been created for {{itemName}}. Current stock: {{quantity}}, Order quantity: {{recommendedOrderQty}}"
      },
      "retry_on_failure": false,
      "max_retries": 1
    }
  ]'::jsonb
);

-- Template 2: Job Completion Notification
INSERT INTO workflow_templates (name, description, category, trigger_type, trigger_config, actions) VALUES
(
  'Job Completion Notification',
  'Send notifications and update records when a job is completed',
  'jobs',
  'job_status',
  '{"targetStatus": "completed"}'::jsonb,
  '[
    {
      "action_type": "send_notification",
      "action_config": {
        "title": "Job Completed",
        "message": "Job {{jobName}} has been marked as completed",
        "type": "success",
        "priority": "normal"
      },
      "retry_on_failure": true,
      "max_retries": 3
    },
    {
      "action_type": "send_email",
      "action_config": {
        "subject": "Job Completed: {{jobName}}",
        "body": "The job {{jobName}} has been successfully completed on {{completedDate}}. Customer: {{customerName}}"
      },
      "retry_on_failure": false,
      "max_retries": 1
    }
  ]'::jsonb
);

-- Template 3: New Job Auto-Assignment
INSERT INTO workflow_templates (name, description, category, trigger_type, trigger_config, actions) VALUES
(
  'New Job Auto-Assignment',
  'Automatically assign new jobs to available workers using round-robin strategy',
  'jobs',
  'job_status',
  '{"targetStatus": "pending"}'::jsonb,
  '[
    {
      "action_type": "assign_worker",
      "action_config": {
        "jobId": "{{jobId}}",
        "strategy": "round_robin"
      },
      "retry_on_failure": true,
      "max_retries": 3
    },
    {
      "action_type": "send_notification",
      "action_config": {
        "title": "Job Assigned",
        "message": "New job {{jobName}} has been assigned to you",
        "type": "info",
        "priority": "normal"
      },
      "retry_on_failure": true,
      "max_retries": 3
    }
  ]'::jsonb
);

-- Template 4: Critical Stock Alert (Out of Stock)
INSERT INTO workflow_templates (name, description, category, trigger_type, trigger_config, actions) VALUES
(
  'Critical Stock Alert',
  'Send urgent notifications when items are completely out of stock',
  'inventory',
  'stock_level',
  '{"condition": "out_of_stock"}'::jsonb,
  '[
    {
      "action_type": "send_notification",
      "action_config": {
        "title": "CRITICAL: Out of Stock",
        "message": "{{itemName}} is completely out of stock! Immediate action required.",
        "type": "error",
        "priority": "urgent"
      },
      "retry_on_failure": true,
      "max_retries": 5
    },
    {
      "action_type": "send_email",
      "action_config": {
        "subject": "URGENT: {{itemName}} Out of Stock",
        "body": "Critical alert: {{itemName}} is completely out of stock. Please order immediately to avoid service disruptions."
      },
      "retry_on_failure": true,
      "max_retries": 3
    },
    {
      "action_type": "create_purchase_order",
      "action_config": {
        "itemId": "{{itemId}}",
        "quantity": "{{recommendedOrderQty}}",
        "notes": "URGENT - Out of stock"
      },
      "retry_on_failure": true,
      "max_retries": 3
    }
  ]'::jsonb
);

-- Template 5: Job Started Notification
INSERT INTO workflow_templates (name, description, category, trigger_type, trigger_config, actions) VALUES
(
  'Job Started Notification',
  'Notify stakeholders when a job is started',
  'jobs',
  'job_status',
  '{"targetStatus": "in_progress"}'::jsonb,
  '[
    {
      "action_type": "send_notification",
      "action_config": {
        "title": "Job Started",
        "message": "Work has begun on job {{jobName}}",
        "type": "info",
        "priority": "normal"
      },
      "retry_on_failure": true,
      "max_retries": 3
    },
    {
      "action_type": "send_email",
      "action_config": {
        "subject": "Job In Progress: {{jobName}}",
        "body": "Our team has started working on {{jobName}}. Expected completion: {{scheduledDate}}"
      },
      "retry_on_failure": false,
      "max_retries": 1
    }
  ]'::jsonb
);

-- Template 6: Weekly Stock Report
INSERT INTO workflow_templates (name, description, category, trigger_type, trigger_config, actions) VALUES
(
  'Weekly Stock Report',
  'Send weekly inventory status report',
  'reporting',
  'time_schedule',
  '{"schedule_type": "weekly", "day": "monday", "time": "09:00"}'::jsonb,
  '[
    {
      "action_type": "send_notification",
      "action_config": {
        "title": "Weekly Stock Report",
        "message": "Your weekly inventory report is ready",
        "type": "info",
        "priority": "normal"
      },
      "retry_on_failure": false,
      "max_retries": 1
    },
    {
      "action_type": "send_email",
      "action_config": {
        "subject": "Weekly Inventory Report - {{currentDate}}",
        "body": "Here is your weekly inventory summary. Low stock items: {{lowStockCount}}, Total items: {{totalItems}}"
      },
      "retry_on_failure": false,
      "max_retries": 1
    }
  ]'::jsonb
);

-- Template 7: Smart Reordering
INSERT INTO workflow_templates (name, description, category, trigger_type, trigger_config, actions) VALUES
(
  'Smart Reordering',
  'Automatically create purchase orders based on AI predictions',
  'inventory',
  'stock_level',
  '{"condition": "below_threshold", "threshold": 10}'::jsonb,
  '[
    {
      "action_type": "conditional",
      "action_config": {
        "condition": {
          "field": "aiPrediction",
          "operator": "greater_than",
          "value": 0.7
        }
      },
      "retry_on_failure": false,
      "max_retries": 1
    },
    {
      "action_type": "create_purchase_order",
      "action_config": {
        "itemId": "{{itemId}}",
        "quantity": "{{aiRecommendedQty}}",
        "supplier": "{{supplier}}",
        "notes": "AI-recommended order based on usage patterns"
      },
      "retry_on_failure": true,
      "max_retries": 3
    },
    {
      "action_type": "send_notification",
      "action_config": {
        "title": "Smart Order Created",
        "message": "AI created purchase order for {{itemName}} ({{aiRecommendedQty}} units)",
        "type": "info",
        "priority": "normal"
      },
      "retry_on_failure": false,
      "max_retries": 1
    }
  ]'::jsonb
);

-- Template 8: Job Overdue Alert
INSERT INTO workflow_templates (name, description, category, trigger_type, trigger_config, actions) VALUES
(
  'Job Overdue Alert',
  'Send alerts for jobs that are past their scheduled completion date',
  'jobs',
  'time_schedule',
  '{"schedule_type": "daily", "time": "10:00"}'::jsonb,
  '[
    {
      "action_type": "send_notification",
      "action_config": {
        "title": "Overdue Jobs Alert",
        "message": "You have {{overdueCount}} overdue jobs requiring attention",
        "type": "warning",
        "priority": "high"
      },
      "retry_on_failure": true,
      "max_retries": 3
    },
    {
      "action_type": "send_email",
      "action_config": {
        "subject": "Overdue Jobs Require Attention",
        "body": "The following jobs are overdue: {{overdueJobsList}}. Please review and update their status."
      },
      "retry_on_failure": false,
      "max_retries": 1
    }
  ]'::jsonb
);

-- Template 9: Stock Movement Logging
INSERT INTO workflow_templates (name, description, category, trigger_type, trigger_config, actions) VALUES
(
  'Stock Movement Logging',
  'Log and notify on significant stock movements',
  'inventory',
  'stock_level',
  '{"condition": "large_movement", "threshold": 50}'::jsonb,
  '[
    {
      "action_type": "send_notification",
      "action_config": {
        "title": "Large Stock Movement",
        "message": "{{quantity}} units of {{itemName}} were {{movementType}}",
        "type": "info",
        "priority": "normal"
      },
      "retry_on_failure": false,
      "max_retries": 1
    },
    {
      "action_type": "webhook",
      "action_config": {
        "url": "{{webhookUrl}}",
        "method": "POST",
        "body": {
          "itemId": "{{itemId}}",
          "itemName": "{{itemName}}",
          "quantity": "{{quantity}}",
          "movementType": "{{movementType}}",
          "timestamp": "{{timestamp}}"
        }
      },
      "retry_on_failure": true,
      "max_retries": 3
    }
  ]'::jsonb
);

-- Template 10: Customer Job Notification
INSERT INTO workflow_templates (name, description, category, trigger_type, trigger_config, actions) VALUES
(
  'Customer Job Notification',
  'Send notifications to customers at different job stages',
  'jobs',
  'job_status',
  '{"targetStatus": "scheduled"}'::jsonb,
  '[
    {
      "action_type": "send_email",
      "action_config": {
        "recipient": "{{customerEmail}}",
        "subject": "Your Appointment is Confirmed - {{jobName}}",
        "body": "Hello {{customerName}}, your appointment for {{jobName}} is scheduled for {{scheduledDate}}. Our technician will arrive between {{timeWindow}}."
      },
      "retry_on_failure": true,
      "max_retries": 3
    },
    {
      "action_type": "send_notification",
      "action_config": {
        "title": "Customer Notified",
        "message": "Confirmation sent to {{customerName}} for job {{jobName}}",
        "type": "success",
        "priority": "normal"
      },
      "retry_on_failure": false,
      "max_retries": 1
    }
  ]'::jsonb
);

-- Template 11: Least Busy Worker Assignment
INSERT INTO workflow_templates (name, description, category, trigger_type, trigger_config, actions) VALUES
(
  'Least Busy Worker Assignment',
  'Assign jobs to the worker with the fewest active jobs',
  'jobs',
  'manual',
  '{}'::jsonb,
  '[
    {
      "action_type": "assign_worker",
      "action_config": {
        "jobId": "{{jobId}}",
        "strategy": "least_busy"
      },
      "retry_on_failure": true,
      "max_retries": 3
    },
    {
      "action_type": "send_notification",
      "action_config": {
        "title": "Job Assigned",
        "message": "Job {{jobName}} assigned based on workload balancing",
        "type": "info",
        "priority": "normal"
      },
      "retry_on_failure": false,
      "max_retries": 1
    }
  ]'::jsonb
);

-- Template 12: Stock Replenishment from Job Completion
INSERT INTO workflow_templates (name, description, category, trigger_type, trigger_config, actions) VALUES
(
  'Stock Replenishment Analysis',
  'Analyze stock usage after job completion and trigger reorders if needed',
  'jobs',
  'job_status',
  '{"targetStatus": "completed"}'::jsonb,
  '[
    {
      "action_type": "update_stock",
      "action_config": {
        "operation": "decrease",
        "notes": "Stock used in job {{jobName}}"
      },
      "retry_on_failure": true,
      "max_retries": 3
    },
    {
      "action_type": "conditional",
      "action_config": {
        "condition": {
          "field": "quantity",
          "operator": "less_than",
          "value": "{{reorderLevel}}"
        }
      },
      "retry_on_failure": false,
      "max_retries": 1
    },
    {
      "action_type": "create_purchase_order",
      "action_config": {
        "itemId": "{{itemId}}",
        "quantity": "{{recommendedOrderQty}}",
        "notes": "Triggered by job completion stock check"
      },
      "retry_on_failure": true,
      "max_retries": 3
    }
  ]'::jsonb
);
