# Specification 05: Job Orchestration (DAGs)

## 1. Goal
To upgrade the Deferred Job queue from executing isolated atomic tasks to orchestrating complex, multi-step workflows (Directed Acyclic Graphs) automatically, removing the orchestration burden from the LLM.

## 2. Core Architecture

### 2.1 Job Dependencies
-   Update `JobRequest` entity in `src/core/entities/job.ts` to include `dependencies: string[]` (an array of `jobIds` that must complete before this job can begin).

### 2.2 Workflow Dispatcher
-   Modify `JobQueueRepository.claimNextQueuedJob`. A job is only eligible to be claimed if its status is `queued` AND all jobs listed in its `dependencies` array have a status of `succeeded`.

### 2.3 Synthetic Workflow Events
-   Create a master `WorkflowJob` that tracks the aggregate progress of its child jobs. When a child job emits a `progress` event, the master job calculates the total workflow completion percentage and streams it to the Chat UI.

## 3. Realistic Use Case
**Media Production Pipeline**: An LLM enqueues a `compose_media` workflow. The system creates Job A (`generate_audio`), Job B (`generate_images`), and Job C (`ffmpeg_compose`). Job C specifies `dependencies: [Job A, Job B]`. The worker runs A and B in parallel, and automatically starts C when they finish.

## 4. Test Cases
1.  **Dependency Locking**: Verify that Job C remains `queued` and cannot be claimed by a worker while Job A is `running`.
2.  **Cascade Failure**: Verify that if Job B fails and exhausts its retries, Job C is automatically marked as `canceled` or `failed_dependency`.
