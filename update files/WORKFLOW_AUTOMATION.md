# Workflow Automation Guide

## Table of Contents
1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Workflow Concepts](#workflow-concepts)
4. [Creating Workflows](#creating-workflows)
5. [Workflow Templates](#workflow-templates)
6. [Trigger Types](#trigger-types)
7. [Action Types](#action-types)
8. [Scheduled Tasks](#scheduled-tasks)
9. [Auto-Assignment Rules](#auto-assignment-rules)
10. [Monitoring & Analytics](#monitoring--analytics)
11. [API Reference](#api-reference)
12. [Best Practices](#best-practices)
13. [Troubleshooting](#troubleshooting)

---

## Overview

PlumbPro Inventory's Workflow Automation system allows you to automate repetitive tasks and business processes. Create custom workflows that trigger automatically based on events like stock levels, job status changes, or scheduled times.

### Key Benefits

- **Save Time**: Automate repetitive tasks like sending notifications and creating purchase orders
- **Reduce Errors**: Consistent execution of business rules without manual intervention
- **Improve Response Time**: Instantly react to stock levels, job changes, and other events
- **Enhance Visibility**: Track all automated actions with detailed execution logs
- **Flexible Configuration**: Use templates or create custom workflows to match your business needs

### What You Can Automate

- Stock reordering when inventory runs low
- Job assignments to workers
- Customer notifications for job status changes
- Purchase order creation
- Email alerts and notifications
- Custom integrations via webhooks
- Scheduled reports and maintenance tasks

---

## Quick Start

### 1. Using a Workflow Template

The fastest way to get started is with a pre-built template:

1. Navigate to **Workflow Automation** in the main menu
2. Click the **Templates** tab
3. Browse available templates (12 pre-built options)
4. Click **Use Template** on a template that matches your needs
5. Give it a custom name and click **Create**
6. The workflow is now active and will trigger automatically

**Recommended First Template**: "Low Stock Alert & Auto-Order"
- Automatically notifies you when items run low
- Creates purchase orders
- Sends email alerts

### 2. Creating a Simple Manual Workflow

Create a workflow you can trigger manually:

1. Click **Create Workflow**
2. Configure:
   - **Name**: "Send Low Stock Report"
   - **Trigger Type**: Manual
   - **Actions**:
     - Action 1: Send Notification (title: "Low Stock Report", message: "Report generated")
     - Action 2: Send Email (subject: "Stock Report", body: "Your weekly stock report")
3. Click **Create**
4. Click **Run Now** to execute it immediately

---

## Workflow Concepts

### Components

Every workflow consists of:

1. **Trigger**: The event that starts the workflow
2. **Actions**: Steps executed when triggered (in order)
3. **Configuration**: Settings for triggers and actions
4. **Execution History**: Log of every time the workflow runs

### Workflow Lifecycle

```
Event Occurs → Trigger Condition Checked → Actions Execute (in order) → Results Logged
```

### Execution Model

- Actions run **sequentially** (one after another)
- Failed actions can **retry** with exponential backoff
- Each execution is **logged** for monitoring
- Workflows can be **enabled/disabled** at any time

---

## Creating Workflows

### Basic Workflow Creation

```javascript
// Example: Create a workflow via API
POST /api/workflows
{
  "name": "Low Stock Alert",
  "description": "Alert when item falls below reorder level",
  "trigger_type": "stock_level",
  "trigger_config": {
    "condition": "below_reorder"
  },
  "is_active": true,
  "priority": 5,
  "actions": [
    {
      "action_order": 1,
      "action_type": "send_notification",
      "action_config": {
        "title": "Low Stock Alert",
        "message": "{{itemName}} is running low ({{quantity}} remaining)",
        "type": "warning",
        "priority": "high"
      },
      "retry_on_failure": true,
      "max_retries": 3
    }
  ]
}
```

### Using Placeholders

Workflows support dynamic data via placeholders:

**Stock Level Workflows:**
- `{{itemId}}` - Item UUID
- `{{itemName}}` - Item name
- `{{quantity}}` - Current quantity
- `{{reorderLevel}}` - Reorder threshold
- `{{supplier}}` - Supplier name
- `{{recommendedOrderQty}}` - Suggested order quantity

**Job Status Workflows:**
- `{{jobId}}` - Job UUID
- `{{jobName}}` - Job name
- `{{status}}` - Current status
- `{{customerName}}` - Customer name
- `{{customerEmail}}` - Customer email
- `{{scheduledDate}}` - Scheduled date

**Example:**
```json
{
  "message": "{{itemName}} is at {{quantity}} units. Reorder at {{reorderLevel}}."
}
```

---

## Workflow Templates

### Available Templates

#### 1. Low Stock Alert & Auto-Order
**Category**: Inventory
**Trigger**: Stock level below reorder point
**Actions**:
- Send notification
- Create purchase order
- Send email to manager

**Use Case**: Automatically restock items before they run out

---

#### 2. Job Completion Notification
**Category**: Jobs
**Trigger**: Job status changes to "completed"
**Actions**:
- Send success notification
- Email confirmation to customer

**Use Case**: Keep customers informed when work is finished

---

#### 3. New Job Auto-Assignment
**Category**: Jobs
**Trigger**: New job created with "pending" status
**Actions**:
- Assign to available worker (round-robin)
- Notify assigned worker

**Use Case**: Automatically distribute work to your team

---

#### 4. Critical Stock Alert
**Category**: Inventory
**Trigger**: Item completely out of stock
**Actions**:
- Send urgent notification
- Send priority email
- Create emergency purchase order

**Use Case**: Immediate alerts for critical stockouts

---

#### 5. Job Started Notification
**Category**: Jobs
**Trigger**: Job status changes to "in_progress"
**Actions**:
- Notify stakeholders
- Email customer

**Use Case**: Update customers when technician arrives

---

#### 6. Weekly Stock Report
**Category**: Reporting
**Trigger**: Scheduled (weekly, Monday 9 AM)
**Actions**:
- Send notification
- Email weekly summary

**Use Case**: Regular inventory status updates

---

#### 7. Smart Reordering
**Category**: Inventory
**Trigger**: Stock below threshold + AI confidence
**Actions**:
- Check AI prediction
- Create purchase order if confident
- Notify manager

**Use Case**: AI-powered inventory optimization

---

#### 8. Job Overdue Alert
**Category**: Jobs
**Trigger**: Scheduled (daily, 10 AM)
**Actions**:
- Check for overdue jobs
- Send alert if found
- Email summary

**Use Case**: Track late jobs proactively

---

#### 9. Stock Movement Logging
**Category**: Inventory
**Trigger**: Large stock movement (50+ units)
**Actions**:
- Log movement
- Send notification
- POST to webhook

**Use Case**: Track significant inventory changes

---

#### 10. Customer Job Notification
**Category**: Jobs
**Trigger**: Job scheduled
**Actions**:
- Email customer confirmation
- Log notification sent

**Use Case**: Automated appointment confirmations

---

#### 11. Least Busy Worker Assignment
**Category**: Jobs
**Trigger**: Manual
**Actions**:
- Find worker with fewest jobs
- Assign job
- Notify worker

**Use Case**: Balance workload across team

---

#### 12. Stock Replenishment Analysis
**Category**: Jobs
**Trigger**: Job completed
**Actions**:
- Update stock quantities
- Check if below reorder level
- Create PO if needed

**Use Case**: Restock items after job usage

---

## Trigger Types

### 1. Stock Level Triggers

Monitor inventory levels and trigger when conditions are met.

**Trigger Type**: `stock_level`

**Conditions:**
```json
{
  "condition": "below_reorder"  // Item <= reorder level
}
```

```json
{
  "condition": "out_of_stock"  // Item = 0
}
```

```json
{
  "condition": "below_threshold",
  "threshold": 10  // Item <= 10 units
}
```

**Triggered By:**
- Stock movements (in/out)
- Inventory updates
- Job completions that use stock

---

### 2. Job Status Triggers

Execute workflows when job status changes.

**Trigger Type**: `job_status`

**Configuration:**
```json
{
  "targetStatus": "completed"  // pending, in_progress, completed, cancelled
}
```

**Triggered By:**
- Job status updates
- Job creation with specific status
- Worker check-in/check-out

---

### 3. Time Schedule Triggers

Run workflows on a schedule.

**Trigger Type**: `time_schedule`

**Daily Schedule:**
```json
{
  "schedule_type": "daily",
  "time": "09:00"  // 9 AM every day
}
```

**Weekly Schedule:**
```json
{
  "schedule_type": "weekly",
  "day": "monday",
  "time": "09:00"  // Monday at 9 AM
}
```

**Monthly Schedule:**
```json
{
  "schedule_type": "monthly",
  "date": 1,
  "time": "09:00"  // 1st of month at 9 AM
}
```

**Hourly Schedule:**
```json
{
  "schedule_type": "hourly"  // Every hour
}
```

**One-Time Schedule:**
```json
{
  "schedule_type": "once",
  "datetime": "2026-01-15T09:00:00Z"
}
```

---

### 4. Manual Triggers

Workflows you execute on demand.

**Trigger Type**: `manual`

**Configuration:**
```json
{}  // No configuration needed
```

**How to Trigger:**
- Via UI: Click "Run Now" button
- Via API: `POST /api/workflows/:id/execute`

---

### 5. Webhook Triggers

Triggered by external systems via HTTP POST.

**Trigger Type**: `webhook`

**Configuration:**
```json
{
  "secret": "your_webhook_secret"  // Optional validation
}
```

**Webhook URL:**
```
POST /api/workflows/trigger
{
  "trigger_type": "webhook",
  "trigger_data": {
    // Your custom data
  }
}
```

---

## Action Types

### 1. Send Notification

Create in-app notification for users.

```json
{
  "action_type": "send_notification",
  "action_config": {
    "title": "Low Stock Alert",
    "message": "{{itemName}} has {{quantity}} units remaining",
    "type": "warning",  // info, success, warning, error
    "priority": "high"  // normal, high, urgent
  }
}
```

---

### 2. Send Email

Send email to user or custom recipient.

```json
{
  "action_type": "send_email",
  "action_config": {
    "recipient": "manager@company.com",  // Optional, defaults to user email
    "subject": "Stock Alert: {{itemName}}",
    "body": "Current stock: {{quantity}}\nReorder level: {{reorderLevel}}"
  }
}
```

---

### 3. Create Job

Automatically create a new job.

```json
{
  "action_type": "create_job",
  "action_config": {
    "name": "Stock Check for {{itemName}}",
    "description": "Verify stock levels",
    "scheduledDate": "2026-01-15T09:00:00Z"
  }
}
```

---

### 4. Update Stock

Modify inventory quantities.

```json
{
  "action_type": "update_stock",
  "action_config": {
    "itemId": "{{itemId}}",
    "quantity": 10,
    "operation": "increase",  // increase or decrease
    "notes": "Auto-adjustment from workflow"
  }
}
```

---

### 5. Assign Worker

Assign jobs to workers automatically.

```json
{
  "action_type": "assign_worker",
  "action_config": {
    "jobId": "{{jobId}}",
    "workerId": "user-uuid",  // Optional
    "strategy": "round_robin"  // round_robin, least_busy, skills_based, location_based
  }
}
```

**Assignment Strategies:**
- `round_robin`: Rotate assignments evenly
- `least_busy`: Assign to worker with fewest active jobs
- `skills_based`: Match based on required skills (requires skill data)
- `location_based`: Assign based on proximity (requires location data)

---

### 6. Create Purchase Order

Generate purchase orders automatically.

```json
{
  "action_type": "create_purchase_order",
  "action_config": {
    "itemId": "{{itemId}}",
    "quantity": "{{recommendedOrderQty}}",
    "supplier": "{{supplier}}",
    "notes": "Auto-generated PO"
  }
}
```

**Result:**
- Creates notification with PO details
- Returns estimated cost
- Can integrate with accounting systems via webhook

---

### 7. Webhook

Call external APIs or services.

```json
{
  "action_type": "webhook",
  "action_config": {
    "url": "https://api.example.com/inventory-update",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer YOUR_TOKEN",
      "Content-Type": "application/json"
    },
    "body": {
      "itemId": "{{itemId}}",
      "quantity": "{{quantity}}",
      "timestamp": "{{timestamp}}"
    }
  }
}
```

**Use Cases:**
- Sync with accounting software
- Update external inventory systems
- Trigger other automation platforms (Zapier, IFTTT)
- Send data to analytics platforms

---

### 8. Update Job Status

Change job status programmatically.

```json
{
  "action_type": "update_job_status",
  "action_config": {
    "jobId": "{{jobId}}",
    "status": "completed"  // pending, in_progress, completed, cancelled
  }
}
```

---

### 9. Delay

Pause workflow execution for a period.

```json
{
  "action_type": "delay",
  "action_config": {
    "duration": 60000  // milliseconds (60000 = 1 minute)
  }
}
```

**Use Cases:**
- Wait before sending follow-up notifications
- Rate limiting for external APIs
- Stagger multiple actions

---

### 10. Conditional

Execute logic based on conditions.

```json
{
  "action_type": "conditional",
  "action_config": {
    "condition": {
      "field": "quantity",
      "operator": "less_than",
      "value": 5
    },
    "ifTrue": "continue",  // Future: execute specific actions
    "ifFalse": "skip"
  }
}
```

**Operators:**
- `equals`: Field == value
- `not_equals`: Field != value
- `greater_than`: Field > value
- `less_than`: Field < value
- `contains`: String contains value

---

## Scheduled Tasks

### Creating a Scheduled Task

Scheduled tasks run workflows on a recurring or one-time basis.

**Via API:**
```javascript
POST /api/workflows
{
  "name": "Daily Stock Report",
  "trigger_type": "time_schedule",
  "trigger_config": {
    "schedule_type": "daily",
    "time": "08:00"
  },
  "actions": [
    {
      "action_type": "send_email",
      "action_config": {
        "subject": "Daily Stock Report",
        "body": "Your daily inventory summary"
      }
    }
  ]
}
```

### Schedule Types

**Daily**: Runs every day at specified time
```json
{
  "schedule_type": "daily",
  "time": "09:00"
}
```

**Weekly**: Runs on specific day each week
```json
{
  "schedule_type": "weekly",
  "day": "monday",  // monday-sunday
  "time": "09:00"
}
```

**Monthly**: Runs on specific date each month
```json
{
  "schedule_type": "monthly",
  "date": 1,  // 1-31
  "time": "09:00"
}
```

**Hourly**: Runs every hour
```json
{
  "schedule_type": "hourly"
}
```

**Once**: Runs one time at specific datetime
```json
{
  "schedule_type": "once",
  "datetime": "2026-01-15T09:00:00Z"
}
```

### Monitoring Scheduled Tasks

View scheduled tasks and their next run time:
```javascript
GET /api/workflows/scheduled-tasks
```

Response:
```json
[
  {
    "id": "task-uuid",
    "name": "Daily Stock Report",
    "schedule_type": "daily",
    "next_run_at": "2026-01-05T08:00:00Z",
    "last_run_at": "2026-01-04T08:00:00Z",
    "is_active": true
  }
]
```

---

## Auto-Assignment Rules

Auto-assignment automatically routes jobs to workers based on configurable rules.

### Creating Assignment Rules

**Via Database:**
```sql
INSERT INTO assignment_rules (
  user_id,
  name,
  entity_type,
  rule_conditions,
  assignment_strategy,
  assignment_config,
  is_active,
  priority
) VALUES (
  'user-uuid',
  'Emergency Job Assignment',
  'job',
  '{"priority": "urgent"}'::jsonb,
  'least_busy',
  '{}'::jsonb,
  true,
  10
);
```

### Assignment Strategies

**Round Robin**: Evenly distribute jobs
- Assigns to worker with fewest total jobs
- Considers assignment history

**Least Busy**: Assign to available worker
- Counts only active jobs (pending, in_progress)
- Best for workload balancing

**Skills Based**: Match required skills
- Requires worker skills data
- Future enhancement

**Location Based**: Assign nearest worker
- Requires GPS data
- Future enhancement

### Rule Conditions

Match jobs based on properties:
```json
{
  "priority": "urgent",  // Only urgent jobs
  "category": "plumbing"  // Only plumbing jobs
}
```

### Priority

Rules with higher priority execute first:
- Priority 10: Emergency rules
- Priority 5: Standard rules
- Priority 1: Fallback rules

---

## Monitoring & Analytics

### Workflow Statistics

View overall workflow performance:

```javascript
GET /api/workflows/stats/summary
```

Response:
```json
{
  "workflows": {
    "total_workflows": 15,
    "active_workflows": 12,
    "trigger_types": 4
  },
  "executions": {
    "total_executions": 234,
    "successful_executions": 228,
    "failed_executions": 6,
    "avg_execution_time": 156  // milliseconds
  },
  "topWorkflows": [
    {
      "id": "workflow-uuid",
      "name": "Low Stock Alert",
      "execution_count": 45
    }
  ]
}
```

### Execution History

View executions for a specific workflow:

```javascript
GET /api/workflows/:workflowId/executions?limit=50&offset=0
```

Response:
```json
[
  {
    "id": "execution-uuid",
    "workflow_id": "workflow-uuid",
    "status": "completed",  // running, completed, failed, cancelled
    "started_at": "2026-01-04T10:30:00Z",
    "completed_at": "2026-01-04T10:30:02Z",
    "execution_time_ms": 2156,
    "trigger_data": {
      "itemId": "item-uuid",
      "quantity": 5
    }
  }
]
```

### Action Logs

View detailed logs for a specific execution:

```javascript
GET /api/workflows/executions/:executionId/logs
```

Response:
```json
[
  {
    "id": "log-uuid",
    "action_type": "send_notification",
    "action_order": 1,
    "status": "success",
    "started_at": "2026-01-04T10:30:00Z",
    "completed_at": "2026-01-04T10:30:01Z",
    "execution_time_ms": 450,
    "output_data": {
      "sent": true,
      "message": "Low stock alert sent"
    },
    "retry_count": 0
  }
]
```

### Dashboard Metrics

Monitor workflow health:

**Success Rate**: (Successful / Total) × 100
- Target: >95%
- Alert if <90%

**Average Execution Time**: Total time / Executions
- Target: <500ms for simple workflows
- Target: <5s for complex workflows

**Failed Executions**: Count of failures
- Investigate any failures
- Check error messages in logs

**Most Active Workflows**: Top 5 by execution count
- Identify your most important automations
- Optimize frequently-run workflows

---

## API Reference

### Workflows

**Get All Workflows**
```
GET /api/workflows
Query params: ?trigger_type=stock_level&is_active=true
```

**Get Workflow**
```
GET /api/workflows/:id
Returns: Workflow with actions array
```

**Create Workflow**
```
POST /api/workflows
Body: { name, description, trigger_type, trigger_config, actions, is_active, priority }
```

**Update Workflow**
```
PUT /api/workflows/:id
Body: { name?, description?, trigger_type?, trigger_config?, is_active?, priority? }
```

**Delete Workflow**
```
DELETE /api/workflows/:id
```

**Execute Workflow**
```
POST /api/workflows/:id/execute
Body: { trigger_data?: {} }
```

**Toggle Active Status**
```
POST /api/workflows/:id/toggle
Returns: Updated workflow
```

### Templates

**Get Templates**
```
GET /api/workflows/templates/list
Query params: ?category=inventory
```

**Create from Template**
```
POST /api/workflows/from-template/:templateId
Body: { name?, customConfig? }
```

### Executions

**Get Executions**
```
GET /api/workflows/:workflowId/executions
Query params: ?limit=50&offset=0
```

**Get Execution Logs**
```
GET /api/workflows/executions/:executionId/logs
```

### Statistics

**Get Stats**
```
GET /api/workflows/stats/summary
Returns: Workflow and execution statistics
```

### Manual Triggers

**Trigger Workflows**
```
POST /api/workflows/trigger
Body: { trigger_type, trigger_data }
```

---

## Best Practices

### 1. Start with Templates

- Use pre-built templates for common scenarios
- Customize templates to fit your needs
- Learn by examining template configurations

### 2. Test Before Activating

- Create workflows as inactive initially
- Use "Run Now" to test manually
- Check execution logs for errors
- Activate only after successful tests

### 3. Use Descriptive Names

Good names:
- "Low Stock Alert & Auto-Order"
- "Urgent Job Assignment to Nearest Tech"
- "Weekly Inventory Report to Management"

Bad names:
- "Workflow 1"
- "Test"
- "Automation"

### 4. Set Appropriate Priorities

- High priority (8-10): Critical alerts, emergency responses
- Medium priority (4-7): Standard automations
- Low priority (1-3): Nice-to-have features

### 5. Configure Retries Wisely

**Enable retries for:**
- Notifications (network issues are common)
- Purchase orders (critical operations)
- Worker assignments (ensure assignment succeeds)

**Disable retries for:**
- Delays (no point in retrying a wait)
- Logging actions (not critical if they fail)
- Conditionals (deterministic logic)

### 6. Monitor Regularly

- Check success rates weekly
- Review failed executions
- Optimize slow workflows
- Disable unused workflows

### 7. Use Placeholders

Instead of hardcoding:
```json
{
  "message": "Item XYZ has 5 units"
}
```

Use placeholders:
```json
{
  "message": "{{itemName}} has {{quantity}} units"
}
```

### 8. Keep Actions Simple

- Break complex workflows into multiple simpler workflows
- Each action should have a single, clear purpose
- Use delays between rate-limited actions

### 9. Document Custom Workflows

Add descriptions:
```json
{
  "name": "Custom Stock Alert",
  "description": "Alerts purchasing manager when critical parts fall below 3 units. Created for emergency response protocol."
}
```

### 10. Clean Up Old Workflows

- Archive or delete unused workflows
- Execution logs are auto-cleaned after 90 days
- Regularly review active workflows

---

## Troubleshooting

### Workflow Not Triggering

**Check:**
1. Is workflow active? (is_active = true)
2. Does trigger condition match? (e.g., quantity actually below reorder level)
3. Are there database connection issues? (check server logs)
4. For scheduled tasks: Is next_run_at in the past?

**Debug:**
```javascript
// Manually trigger to test
POST /api/workflows/:id/execute
{
  "trigger_data": {
    "itemId": "test-item-uuid",
    "quantity": 5
  }
}
```

---

### Action Failing

**Check execution logs:**
```javascript
GET /api/workflows/executions/:executionId/logs
```

**Common Issues:**

1. **Email Action Fails**
   - Check SMTP configuration in .env
   - Verify recipient email is valid
   - Check email service rate limits

2. **Webhook Action Fails**
   - Verify URL is accessible
   - Check authentication headers
   - Review response status code

3. **Create Job/PO Fails**
   - Verify referenced IDs exist
   - Check user permissions
   - Ensure required fields are provided

---

### Slow Execution

**Optimize:**
1. Remove unnecessary delays
2. Reduce number of actions
3. Use webhooks asynchronously
4. Check for database query performance

**Monitor:**
```javascript
GET /api/workflows/stats/summary
// Check avg_execution_time
```

Target: <500ms for simple workflows

---

### High Failure Rate

**Investigate:**
1. Review error messages in execution logs
2. Check action retry counts
3. Verify external services are available
4. Test manually with known-good data

**Fix:**
- Increase max_retries for flaky actions
- Add error handling in webhook endpoints
- Simplify complex condition logic

---

### Scheduled Tasks Not Running

**Check:**
1. Are cron jobs enabled? (ENABLE_NOTIFICATIONS !== 'false')
2. Is server running continuously?
3. Check next_run_at timestamp

**View scheduled tasks:**
```sql
SELECT * FROM scheduled_tasks
WHERE is_active = TRUE
ORDER BY next_run_at;
```

**Manually trigger scheduler:**
```javascript
// In server console
runScheduledTasks();
```

---

### Too Many Executions

**Prevent:**
1. Add delays between actions
2. Use conditionals to filter executions
3. Increase trigger thresholds
4. Set workflow priority lower

**Example: Rate Limiting**
```json
{
  "actions": [
    {
      "action_type": "send_email",
      "action_config": { ... }
    },
    {
      "action_type": "delay",
      "action_config": {
        "duration": 300000  // 5 minutes between emails
      }
    }
  ]
}
```

---

## Advanced Examples

### Multi-Stage Approval Workflow

```json
{
  "name": "Purchase Order Approval",
  "trigger_type": "manual",
  "actions": [
    {
      "action_type": "send_notification",
      "action_config": {
        "title": "PO Approval Needed",
        "message": "PO for {{itemName}} requires approval"
      }
    },
    {
      "action_type": "delay",
      "action_config": {
        "duration": 3600000  // Wait 1 hour
      }
    },
    {
      "action_type": "conditional",
      "action_config": {
        "condition": {
          "field": "approved",
          "operator": "equals",
          "value": true
        }
      }
    },
    {
      "action_type": "create_purchase_order",
      "action_config": {
        "itemId": "{{itemId}}",
        "quantity": "{{quantity}}"
      }
    }
  ]
}
```

---

### Customer Journey Automation

```json
{
  "name": "Complete Customer Journey",
  "trigger_type": "job_status",
  "trigger_config": {
    "targetStatus": "scheduled"
  },
  "actions": [
    {
      "action_type": "send_email",
      "action_config": {
        "recipient": "{{customerEmail}}",
        "subject": "Appointment Confirmed",
        "body": "Your appointment is scheduled for {{scheduledDate}}"
      }
    },
    {
      "action_type": "delay",
      "action_config": {
        "duration": 86400000  // 24 hours
      }
    },
    {
      "action_type": "send_email",
      "action_config": {
        "recipient": "{{customerEmail}}",
        "subject": "Reminder: Appointment Tomorrow",
        "body": "Your appointment with {{technicianName}} is tomorrow"
      }
    }
  ]
}
```

---

### Inventory Optimization with AI

```json
{
  "name": "AI-Powered Reordering",
  "trigger_type": "stock_level",
  "trigger_config": {
    "condition": "below_threshold",
    "threshold": 15
  },
  "actions": [
    {
      "action_type": "conditional",
      "action_config": {
        "condition": {
          "field": "aiPrediction",
          "operator": "greater_than",
          "value": 0.75
        }
      }
    },
    {
      "action_type": "create_purchase_order",
      "action_config": {
        "itemId": "{{itemId}}",
        "quantity": "{{aiRecommendedQty}}",
        "notes": "AI confidence: {{aiConfidence}}"
      }
    },
    {
      "action_type": "webhook",
      "action_config": {
        "url": "https://analytics.example.com/track",
        "method": "POST",
        "body": {
          "event": "ai_purchase_order",
          "itemId": "{{itemId}}",
          "confidence": "{{aiConfidence}}"
        }
      }
    }
  ]
}
```

---

## Database Schema Reference

### Main Tables

**workflows**: Workflow definitions
- id, user_id, name, description
- trigger_type, trigger_config
- is_active, priority

**workflow_actions**: Actions in workflows
- id, workflow_id, action_order
- action_type, action_config
- retry_on_failure, max_retries

**workflow_executions**: Execution history
- id, workflow_id, user_id
- trigger_data, status
- started_at, completed_at, execution_time_ms

**workflow_action_logs**: Action execution logs
- id, execution_id, action_id
- status, input_data, output_data
- error_message, retry_count

**scheduled_tasks**: Time-based tasks
- id, user_id, workflow_id
- schedule_type, schedule_config
- next_run_at, last_run_at

**workflow_templates**: Pre-built templates
- id, name, description, category
- trigger_type, trigger_config, actions

**assignment_rules**: Auto-assignment rules
- id, user_id, name
- entity_type, rule_conditions
- assignment_strategy, assignment_config

**stock_triggers**: Stock monitoring
- id, user_id, item_id
- trigger_type, threshold_value, workflow_id

---

## Support & Resources

### Getting Help

1. Check execution logs for specific errors
2. Review this documentation
3. Examine working templates for examples
4. Check server logs for system-level issues

### Feature Requests

Workflow automation is actively developed. Upcoming features:
- Visual workflow builder
- More sophisticated conditionals (AND/OR logic)
- Parallel action execution
- Workflow versioning
- A/B testing for workflows
- External integrations (Slack, Teams, etc.)

### Performance Optimization

For high-volume workflows:
- Use database indexes for trigger fields
- Batch notifications where possible
- Implement rate limiting
- Monitor execution time metrics
- Consider async processing for webhooks

---

## Conclusion

Workflow Automation transforms PlumbPro Inventory from a passive tool into an active business partner. By automating repetitive tasks, you free up time to focus on growing your business while ensuring nothing falls through the cracks.

Start with templates, experiment with custom workflows, and watch your efficiency soar!
