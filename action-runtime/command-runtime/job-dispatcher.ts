/** Spec: action-runtime/command-runtime/job-dispatcher.ts */
import { DaemonError, ErrorCodes } from "@daemon/platform-types";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface Job {
  id: string;
  status: JobStatus;
  attempts: number;
  lastError?: string;
}

const TERMINAL: ReadonlySet<JobStatus> = new Set(["succeeded", "failed"]);

/**
 * Tracks job lifecycle from enqueue through terminal state and enforces legal
 * status transitions. Failed jobs may be retried (re-queued) up to a configured
 * attempt ceiling; terminal-success jobs are immutable.
 */
export class JobDispatcher {
  private readonly jobs = new Map<string, Job>();

  constructor(private readonly maxAttempts = 3) {}

  enqueue(id: string): Job {
    if (this.jobs.has(id)) {
      throw new DaemonError(ErrorCodes.CONFLICT, `job ${id} already exists`, 409);
    }
    const job: Job = { id, status: "queued", attempts: 0 };
    this.jobs.set(id, job);
    return job;
  }

  start(id: string): Job {
    const job = this.require(id);
    if (job.status !== "queued") {
      throw new DaemonError(ErrorCodes.CONFLICT, `job ${id} not queued`, 409);
    }
    job.status = "running";
    job.attempts += 1;
    return job;
  }

  complete(id: string, error?: string): Job {
    const job = this.require(id);
    if (job.status !== "running") {
      throw new DaemonError(ErrorCodes.CONFLICT, `job ${id} not running`, 409);
    }
    if (error) {
      job.status = "failed";
      job.lastError = error;
    } else {
      job.status = "succeeded";
      job.lastError = undefined;
    }
    return job;
  }

  /** Re-queue a failed job if attempts remain. */
  retry(id: string): Job {
    const job = this.require(id);
    if (job.status !== "failed") {
      throw new DaemonError(ErrorCodes.CONFLICT, `job ${id} is not failed`, 409);
    }
    if (job.attempts >= this.maxAttempts) {
      throw new DaemonError(ErrorCodes.CONFLICT, `job ${id} exhausted retries`, 409);
    }
    job.status = "queued";
    return job;
  }

  get(id: string): Job {
    return { ...this.require(id) };
  }

  pending(): string[] {
    return [...this.jobs.values()]
      .filter((j) => !TERMINAL.has(j.status))
      .map((j) => j.id)
      .sort();
  }

  private require(id: string): Job {
    const job = this.jobs.get(id);
    if (!job) {
      throw new DaemonError(ErrorCodes.NOT_FOUND, `job ${id} not found`, 404);
    }
    return job;
  }
}
