import type { Channel } from "amqplib";
import { optional } from "./env.js";

/**
 * RabbitMQ names, identical to the backend's MqNames.java. Task routing keys are the task types.
 *   {prefix}.tasks  -> {prefix}.tasks.ai (script.write, world.design, voice.synthesize, visual.plan)
 *                   -> {prefix}.tasks.render (render.finalize)
 *   {prefix}.events -> {prefix}.results (result), {prefix}.progress (progress)
 */
export class MqNames {
  static readonly AI_TASKS = [
    "script.write",
    "world.design",
    "voice.synthesize",
    "visual.plan",
    "storyboard.build",
    "scene.redo",
  ] as const;
  static readonly RENDER_TASKS = ["render.finalize"] as const;
  static readonly RESULT_KEY = "result";
  static readonly PROGRESS_KEY = "progress";

  constructor(readonly prefix = optional("ERKASA_MQ_PREFIX", "erkasa")) {}

  get tasksExchange(): string {
    return `${this.prefix}.tasks`;
  }
  get eventsExchange(): string {
    return `${this.prefix}.events`;
  }
  get aiQueue(): string {
    return `${this.prefix}.tasks.ai`;
  }
  get renderQueue(): string {
    return `${this.prefix}.tasks.render`;
  }
  get resultsQueue(): string {
    return `${this.prefix}.results`;
  }
  get progressQueue(): string {
    return `${this.prefix}.progress`;
  }

  /** Same declarations as the backend (idempotent), so either side can start first. */
  async declare(ch: Channel): Promise<void> {
    await ch.assertExchange(this.tasksExchange, "direct", { durable: true });
    await ch.assertExchange(this.eventsExchange, "direct", { durable: true });
    for (const q of [this.aiQueue, this.renderQueue, this.resultsQueue, this.progressQueue])
      await ch.assertQueue(q, { durable: true });
    for (const key of MqNames.AI_TASKS) await ch.bindQueue(this.aiQueue, this.tasksExchange, key);
    for (const key of MqNames.RENDER_TASKS) await ch.bindQueue(this.renderQueue, this.tasksExchange, key);
    await ch.bindQueue(this.resultsQueue, this.eventsExchange, MqNames.RESULT_KEY);
    await ch.bindQueue(this.progressQueue, this.eventsExchange, MqNames.PROGRESS_KEY);
  }
}

/** amqp://user:pass@host:port from ERKASA_RABBIT_URL or the ERKASA_RABBIT_* variables (see .env.example). */
export function rabbitUrl(): string {
  const url = optional("ERKASA_RABBIT_URL", "");
  if (url) return url;
  const host = optional("ERKASA_RABBIT_HOST", "localhost");
  const port = optional("ERKASA_RABBIT_PORT", "5673");
  const user = encodeURIComponent(optional("ERKASA_RABBIT_USER", "erkasa"));
  const pass = encodeURIComponent(optional("ERKASA_RABBIT_PASSWORD", "erkasa_local"));
  return `amqp://${user}:${pass}@${host}:${port}`;
}
