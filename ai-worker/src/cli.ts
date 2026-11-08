import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { Theme } from "@erkasa/contracts";
import { MissingConfigError } from "./env.js";
import { AnthropicLlm } from "./llm.js";
import { makeVideo } from "./make.js";
import { THEME_BRIEFS } from "./script-writer.js";
import { ElevenLabsVoice, listVoices, voiceExists } from "./voice.js";
import { loadVoiceCatalog, voiceCatalogPath } from "./voice-catalog.js";

const USAGE = `Usage:
  pnpm video "<topic>" --theme <theme> [--voice <id>] [--seconds 45] [--notes "..."] [--no-voice] [--no-music]
  pnpm video --from-script <run>/script.json [--voice <id>] [--no-voice]
  pnpm video --from-plan <run>/video-plan.json [--voice <id>] [--no-voice]
  pnpm voices                 the studio voices (voices/catalog.json) and whether your account can use them
  pnpm voices --samples       writes a short sample of each voice to voices/samples/ (Studio > Voices plays them)
  pnpm voices --account       every voice on your ElevenLabs account, to add new ones to the catalog

Themes: ${Object.keys(THEME_BRIEFS).join(", ")}
Keys come from .env at the repo root: ANTHROPIC_API_KEY, ELEVENLABS_API_KEY. Default voice: ERKASA_VOICE or the catalog default.`;

/** pnpm runs package scripts inside the package folder; paths the user typed are relative to where they typed them. */
const userPath = (p: string): string => resolve(process.env["INIT_CWD"] ?? process.cwd(), p);

async function make(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      theme: { type: "string" },
      voice: { type: "string" },
      seconds: { type: "string" },
      notes: { type: "string" },
      "from-script": { type: "string" },
      "from-plan": { type: "string" },
      "no-voice": { type: "boolean", default: false },
      "no-music": { type: "boolean", default: false },
      out: { type: "string" },
    },
  });
  const topic = positionals.join(" ").trim();
  const fromScript = values["from-script"];
  const fromPlan = values["from-plan"];
  if (!topic && !fromScript && !fromPlan) throw new UsageError("give a topic, --from-script or --from-plan");
  let theme: Exclude<Theme, "everyday"> | undefined;
  if (topic) {
    const parsed = Theme.exclude(["everyday"]).safeParse(values.theme);
    if (!parsed.success)
      throw new UsageError(`--theme must be one of: ${Object.keys(THEME_BRIEFS).join(", ")}`);
    theme = parsed.data;
  }
  const seconds = values.seconds ? Number(values.seconds) : 45;
  if (!Number.isFinite(seconds) || seconds < 20 || seconds > 120)
    throw new UsageError("--seconds must be 20..120");

  const noVoice = values["no-voice"] === true;
  const report = await makeVideo(
    {
      ...(topic ? { topic } : {}),
      ...(theme ? { theme } : {}),
      seconds,
      ...(values.notes ? { notes: values.notes } : {}),
      ...(fromScript ? { fromScript: userPath(fromScript) } : {}),
      ...(fromPlan ? { fromPlan: userPath(fromPlan) } : {}),
      ...(values.out ? { outDir: userPath(values.out) } : {}),
      noVoice,
      ...(values.voice ? { voice: values.voice } : {}),
      music: values["no-music"] !== true,
    },
    {
      ...(fromPlan ? {} : { llm: new AnthropicLlm() }),
      ...(noVoice ? {} : { voiceFor: (preset) => new ElevenLabsVoice(preset) }),
    },
  );
  console.info("");
  if (report.video) console.info(`done: ${report.video} (${report.durationSec?.toFixed(1)} s)`);
  else console.info(`stopped before rendering; see ${report.outDir}`);
  const tokens = report.usage.reduce((n, u) => n + u.inputTokens + u.outputTokens, 0);
  if (report.usage.length)
    console.info(
      `Claude: ${report.usage.length} calls, ${tokens} tokens${report.llmCostUsd !== undefined ? `, ~$${report.llmCostUsd.toFixed(3)}` : ""}`,
    );
  if (report.voiceCharacters) console.info(`ElevenLabs: ${report.voiceCharacters} characters`);
  if (!report.video) process.exitCode = 1;
}

const SAMPLE_LINE =
  "Most people think they are bad with money. They are not. Nobody ever showed them how it actually works.";

async function voices(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      samples: { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      account: { type: "boolean", default: false },
    },
  });
  if (values.account) {
    const list = await listVoices();
    for (const v of list) {
      const labels = Object.entries(v.labels)
        .map(([k, val]) => `${k}=${val}`)
        .join(", ");
      console.info(`${v.voiceId}  ${v.name.padEnd(28)} ${v.category.padEnd(12)} ${labels}`);
    }
    console.info(
      `\n${list.length} voices on your account. Add one to voices/catalog.json to offer it in the studio.`,
    );
    return;
  }
  const catalog = loadVoiceCatalog();
  console.info(`Studio voices (${voiceCatalogPath()}):\n`);
  for (const v of catalog.voices) {
    const ok = await voiceExists(v.providerVoiceId);
    const tags = [v.gender, v.age?.replace("_", " "), v.accent].filter(Boolean).join(", ");
    console.info(
      `${v.id === catalog.default ? "*" : " "} ${v.id.padEnd(18)} ${v.name.padEnd(16)} ${tags.padEnd(30)} ${ok ? "ok" : "NOT AVAILABLE: add it to My Voices in ElevenLabs"}`,
    );
  }
  console.info(`\n* = default. Choose with: pnpm video "<topic>" --theme <theme> --voice <id>`);
  if (!values.samples) return;
  for (const v of catalog.voices) {
    const file = join(dirname(voiceCatalogPath()), "samples", `${v.id}.mp3`);
    if (existsSync(file) && !values.force) {
      console.info(`sample ${v.id}: exists (use --force to redo)`);
      continue;
    }
    const speech = await new ElevenLabsVoice(v).speak({ text: SAMPLE_LINE, seed: 7 });
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, speech.audio);
    console.info(`sample ${v.id}: ${file} (${speech.characters} characters)`);
  }
}

class UsageError extends Error {}

const [command, ...rest] = process.argv.slice(2);
try {
  if (command === "make") await make(rest);
  else if (command === "voices") await voices(rest);
  else throw new UsageError(`unknown command '${command ?? ""}'`);
} catch (e) {
  if (e instanceof UsageError) console.error(`${e.message}\n\n${USAGE}`);
  else if (e instanceof MissingConfigError) console.error(e.message);
  else console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
