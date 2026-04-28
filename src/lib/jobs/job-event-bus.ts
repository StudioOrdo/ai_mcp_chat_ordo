import { EventEmitter } from "node:events";

interface JobCanceledPayload {
  jobId: string;
  canceledBy: string;
}

const JOB_CANCELED_EVENT = "job_canceled";

class JobEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  emitJobCanceled(jobId: string, canceledBy: string): void {
    this.emitter.emit(JOB_CANCELED_EVENT, { jobId, canceledBy } satisfies JobCanceledPayload);
  }

  onJobCanceled(jobId: string, listener: (payload: JobCanceledPayload) => void): () => void {
    const handler = (payload: JobCanceledPayload) => {
      if (payload.jobId === jobId) {
        listener(payload);
      }
    };

    this.emitter.on(JOB_CANCELED_EVENT, handler);

    return () => {
      this.emitter.off(JOB_CANCELED_EVENT, handler);
    };
  }
}

export const jobEventBus = new JobEventBus();